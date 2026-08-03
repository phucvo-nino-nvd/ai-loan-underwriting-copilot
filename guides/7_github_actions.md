# 7. Deploy and destroy from GitHub Actions

One workflow, `.github/workflows/infra.yml`, applies or destroys any subset of the six phases. It calls the same `deploy.py` scripts you run locally through `.github/scripts/phases.sh`, so there is one deployment path, not two.

The prerequisite is remote state. A runner is a fresh machine that only has what `git clone` gives it, and `terraform/*/terraform.tfstate` is gitignored. Without shared state a runner's `apply` tries to create resources that already exist, and its `destroy` reports nothing to do while the bill keeps running. Everything in the first section exists to move state into S3 once.

## 1. Grant the group access to the state bucket

The deploy identity cannot grant itself permissions, so this one comes first and from the Console: IAM → User groups → `AluciAccess` → Add permissions → Create inline policy, named `AluciStatePolicy`.

The bucket does not exist yet, which is why the first statement includes `s3:CreateBucket` — the next step runs as the deploy identity like every other phase. `s3:DeleteObject` covers the lock file Terraform writes next to the state; `s3:ListBucket` is what `terraform init` uses to find an existing state.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:ListBucket",
        "s3:GetBucketVersioning",
        "s3:PutBucketVersioning",
        "s3:GetBucketPublicAccessBlock",
        "s3:PutBucketPublicAccessBlock"
      ],
      "Resource": "arn:aws:s3:::aluci-tfstate-<account-id>"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::aluci-tfstate-<account-id>/*"
    }
  ]
}
```

## 2. Create the state bucket

Versioning is what lets you roll back a state file someone corrupted. Public access is blocked because state holds ARNs and generated names.

```bash
export STATE_BUCKET=aluci-tfstate-$(aws sts get-caller-identity --query Account --output text)

aws s3api create-bucket \
  --bucket "$STATE_BUCKET" \
  --region ap-southeast-1 \
  --create-bucket-configuration LocationConstraint=ap-southeast-1
aws s3api put-bucket-versioning \
  --bucket "$STATE_BUCKET" \
  --versioning-configuration Status=Enabled
aws s3api put-public-access-block \
  --bucket "$STATE_BUCKET" \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

## 3. Move the local state up

Each `terraform/<n>_*/main.tf` now carries a `backend "s3"` block with its own key. The bucket name is deliberately not in the file — it contains your account id, and these files are committed — so it goes in at `init` time. Run this once per phase you have already deployed; `-migrate-state` copies the local file up and asks for confirmation:

```bash
for phase in 1_sagemaker 2_ingestion 3_copilot 4_database 5_api 6_frontend; do
  terraform -chdir="terraform/$phase" init -migrate-state \
    -backend-config="bucket=$STATE_BUCKET"
done
```

Verify, then the local copies are dead weight:

```bash
aws s3 ls "s3://$STATE_BUCKET/" --recursive
rm terraform/*/terraform.tfstate terraform/*/terraform.tfstate.backup
```

Phase 6 reads phase 5's Function URL out of its state, so it needs the bucket name as a variable too. `terraform/6_frontend/terraform.tfvars` already has it; keep the two values identical.

## 4. Configure the repository

GitHub → Settings → Secrets and variables → Actions.

Variables tab — visible in logs, which makes failures readable:

| Name | Value |
| --- | --- |
| `STATE_BUCKET` | `aluci-tfstate-<account-id>` |

Secrets tab — the values `terraform.tfvars` and `.env` hold locally:

| Name | Where it comes from |
| --- | --- |
| `AWS_ACCESS_KEY_ID` | the `aluci-deployer` access key |
| `AWS_SECRET_ACCESS_KEY` | same key pair |
| `OPENROUTER_API_KEY` | `terraform/3_copilot/terraform.tfvars` |
| `LANGSMITH_API_KEY` | same file; leave empty to disable tracing |
| `CLERK_JWKS_URL` | `terraform/5_api/terraform.tfvars` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `frontend/.env.local`, baked into the static build |

Everything else the workflow needs — endpoint name, copilot URL, Aurora ARNs, ingest function name — is read from the state of the phase that created it, so there is nothing to keep in sync by hand.

## 5. Run it

Actions → **infra** → Run workflow:

| Input | Meaning |
| --- | --- |
| `action` | `apply` or `destroy` |
| `phases` | space separated, default `1 2 3 4 5 6`. `destroy` reverses them |
| `seed_database` | phase 4 only. Off by default because seeding deletes every applicant, assessment and decision |

Redeploying after a code change is the same workflow with one phase: `5` for the API, `6` for the frontend, `3` for the copilot.

Two things `apply` does that the guides make you do by hand. It invalidates the CloudFront cache after uploading the frontend, and after phase 6 it re-applies phase 5 to switch the Function URL to `AWS_IAM` and point CORS at the CloudFront origin — the order phase 5 and 6 depend on each other in.

`destroy` with all six phases empties the account of `aluci-*` resources. Aurora has `skip_final_snapshot = true`, so the database and everything seeded into it is gone, permanently. Keep the state bucket: destroying is not the same as forgetting.

## Running the same thing locally

The script is not Actions-specific:

```bash
STATE_BUCKET=$STATE_BUCKET ACTION=apply PHASES="5 6" bash .github/scripts/phases.sh
```

## Troubleshooting

`Backend initialization required` on any local `terraform` command — that directory has no `.terraform` yet. `terraform -chdir=terraform/<phase> init -backend-config="bucket=$STATE_BUCKET"`.

`Error acquiring the state lock` — a previous run died holding it. Confirm nothing is running, then delete `<phase>/terraform.tfstate.tflock` in the bucket.

`phase N has no <output> yet` — the workflow refuses to deploy phase 5 with a missing input rather than shipping an API that cannot reach the database. Apply phase N first.

`No such file or directory: output/models` in phase 1 — the models are committed (`git add -f output/models`, since `output/` is otherwise gitignored), so this means a retrained model never got pushed. `train_data.parquet` stays out: 200MB is over GitHub's per-file limit, and only retraining reads it.

The site loads but sign-in silently fails — `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` was missing at build time. It is baked into the bundle, so fix the secret and re-run phase 6.
