#!/usr/bin/env bash
# Applies or destroys the aluci phases. The workflow passes ACTION/PHASES/SEED as env
# vars; it runs the same way on your machine:
#
#   STATE_BUCKET=aluci-tfstate-<account-id> ACTION=apply PHASES=5 bash .github/scripts/phases.sh
#
# Every phase keeps its state in STATE_BUCKET, so a runner that has never seen this
# repo before still knows what exists.
set -euo pipefail

ACTION="${ACTION:-apply}"
PHASES="${PHASES:-1 2 3 4 5 6}"
SEED="${SEED:-false}"
: "${STATE_BUCKET:?set STATE_BUCKET to the bucket holding the Terraform state}"

# Without this, missing credentials surface as a Terraform backend error about EC2 IMDS.
if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "AWS credentials are not usable — check the AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY secrets" >&2
  exit 1
fi

export TF_IN_AUTOMATION=1
export TF_VAR_state_bucket="$STATE_BUCKET"
export TF_VAR_aws_region="${TF_VAR_aws_region:-${AWS_REGION:-ap-southeast-1}}"

phase_dir() {
  case "$1" in
    1) echo terraform/1_sagemaker ;;
    2) echo terraform/2_ingestion ;;
    3) echo terraform/3_copilot ;;
    4) echo terraform/4_database ;;
    5) echo terraform/5_api ;;
    6) echo terraform/6_frontend ;;
    *) echo "unknown phase: $1" >&2; return 2 ;;
  esac
}

tf() { terraform -chdir="$(phase_dir "$1")" "${@:2}"; }

init() {
  [ -d "$(phase_dir "$1")/.terraform" ] && return 0
  tf "$1" init -input=false -reconfigure -backend-config="bucket=$STATE_BUCKET" >/dev/null
}

# Cross-phase wiring. Locally these values live in terraform.tfvars, which is gitignored
# and so absent on a runner; read them back out of the state instead of pasting them.
out() {
  init "$1"
  local value
  value="$(tf "$1" output -raw "$2" 2>/dev/null || true)"
  # try() placeholders in outputs.tf mean "the resource does not exist yet".
  [ "$value" = "Not created yet" ] && value=""
  echo "$value"
}

require_out() {
  local value
  value="$(out "$1" "$2")"
  if [ -z "$value" ]; then
    echo "phase $1 has no $2 yet — apply phase $1 before this one" >&2
    return 1
  fi
  echo "$value"
}

# Phase 5 takes every other phase as input, and an empty one is worse than a failure:
# Terraform would happily deploy an API that cannot reach the database.
export_api_vars() {
  TF_VAR_classifier_endpoint_name="$(require_out 1 classifier_endpoint_name)"
  TF_VAR_ingest_function_name="$(require_out 2 ingest_function_name)"
  TF_VAR_copilot_url="$(require_out 3 copilot_url)"
  TF_VAR_aurora_cluster_arn="$(require_out 4 aurora_cluster_arn)"
  TF_VAR_aurora_secret_arn="$(require_out 4 aurora_secret_arn)"
  TF_VAR_aurora_database="$(require_out 4 aurora_database)"
  export TF_VAR_classifier_endpoint_name TF_VAR_ingest_function_name TF_VAR_copilot_url
  export TF_VAR_aurora_cluster_arn TF_VAR_aurora_secret_arn TF_VAR_aurora_database

  # The Function URL can only be closed once CloudFront exists to sign for it.
  local cloudfront_url
  cloudfront_url="$(out 6 cloudfront_url)"
  if [ -n "$cloudfront_url" ]; then
    export TF_VAR_function_url_auth_type=AWS_IAM
    export TF_VAR_cors_origins="$cloudfront_url"
  else
    export TF_VAR_function_url_auth_type=NONE
    export TF_VAR_cors_origins=http://localhost:3000
  fi

  # api_image_uri normally comes from terraform.tfvars. Without it a bare apply
  # resolves the variable to "" and destroys the Lambda, so recover the live image.
  local function_name
  function_name="$(out 5 api_function_name)"
  if [ -n "$function_name" ]; then
    TF_VAR_api_image_uri="$(aws lambda get-function --function-name "$function_name" \
      --query Code.ImageUri --output text)"
    export TF_VAR_api_image_uri
  fi
}

apply_phase() {
  echo "::group::apply phase $1"
  init "$1"
  case "$1" in
    1)
      tf 1 apply -auto-approve -input=false
      python backend/classifier/deploy.py
      ;;
    2)
      tf 2 apply -auto-approve -input=false
      python backend/ingest/deploy.py
      ;;
    3)
      tf 3 apply -auto-approve -input=false
      python backend/copilot/deploy.py
      ;;
    4)
      tf 4 apply -auto-approve -input=false
      AURORA_CLUSTER_ARN="$(require_out 4 aurora_cluster_arn)"
      AURORA_SECRET_ARN="$(require_out 4 aurora_secret_arn)"
      AURORA_DATABASE="$(require_out 4 aurora_database)"
      export AURORA_CLUSTER_ARN AURORA_SECRET_ARN AURORA_DATABASE
      (cd backend/database && uv run run_migrations.py)
      if [ "$SEED" = true ]; then
        (cd backend/database && uv run seed_data.py)
      fi
      ;;
    5)
      export_api_vars
      tf 5 apply -auto-approve -input=false
      python backend/api/package_docker.py
      ;;
    6)
      if [ -z "${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-}" ] && [ ! -f frontend/.env.local ]; then
        echo "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is unset — the build would ship a site nobody can sign in to" >&2
        return 1
      fi
      [ -d frontend/node_modules ] || (cd frontend && npm ci)
      tf 6 apply -auto-approve -input=false
      # Set the bucket so deploy.py skips the apply it would otherwise run to find it.
      FRONTEND_BUCKET="$(require_out 6 s3_bucket)" python frontend/deploy.py
      # index.html is cached for an hour, so a deploy without this serves the old bundle.
      aws cloudfront create-invalidation --distribution-id "$(require_out 6 distribution_id)" --paths '/*'
      # Phase 5 was applied while CloudFront did not exist, leaving its Function URL public.
      # It exists now: close it and point CORS at the real origin.
      export_api_vars
      tf 5 apply -auto-approve -input=false
      ;;
  esac
  echo "::endgroup::"
}

destroy_phase() {
  echo "::group::destroy phase $1"
  init "$1"
  # Phase 6 reads phase 5's state, so this only works back to front — hence the reverse order below.
  tf "$1" destroy -auto-approve -input=false
  echo "::endgroup::"
}

ordered=$PHASES
if [ "$ACTION" = destroy ]; then
  ordered="$(echo "$PHASES" | tr ' ' '\n' | sort -rn | tr '\n' ' ')"
fi

for phase in $ordered; do
  case "$ACTION" in
    apply) apply_phase "$phase" ;;
    destroy) destroy_phase "$phase" ;;
    *) echo "ACTION must be apply or destroy, got: $ACTION" >&2; exit 2 ;;
  esac
done

echo "$ACTION finished for phases: $ordered"
