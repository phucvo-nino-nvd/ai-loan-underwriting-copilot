# 0. AWS permissions and CLI setup

This guide prepares one AWS identity for the six deployment phases. All commands assume you start from the repository root.

## Prerequisites

```bash
aws --version
terraform version
docker --version
python --version
node --version
```

Install anything missing: [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), [Terraform](https://developer.hashicorp.com/terraform/install), [Docker](https://docs.docker.com/get-docker/), Python 3.12+, Node.js 20+.

## Choose a region

Use one region for every guide. The examples use Singapore. Every `terraform.tfvars` must carry the same value as `aws_region`.

```bash
export AWS_REGION=ap-southeast-1
export AWS_DEFAULT_REGION=ap-southeast-1
```

Re-export these before each deployment session, or keep one terminal open.

## Create the deploy identity

Create one IAM user for this project — `aluci-deployer` — and one IAM group — `AluciAccess` — and add the user to the group.

Permissions are **not** granted all at once. Each guide from 1 to 6 contains the policy for its own phase, and you attach that policy to the group when you reach the phase. The group accumulates, so phase 6 runs with the union of all six policies. This keeps every phase's blast radius visible and lets you stop at any phase without over-granting.

```bash
aws iam create-group --group-name AluciAccess
aws iam add-user-to-group --group-name AluciAccess --user-name aluci-deployer
```

Attaching each phase policy (repeat per guide with that guide's JSON):

```bash
aws iam put-group-policy \
  --group-name AluciAccess \
  --policy-name AluciSageMakerPolicy \
  --policy-document file://policy.json
```

The Console works too: IAM → User groups → `AluciAccess` → Permissions → Add permissions → Create inline policy.

Note this is a deployment identity, not a developer one: Terraform creates IAM roles, passes them to Lambda and SageMaker, and creates public endpoints. Everything it touches is named `aluci-*` except the S3 frontend bucket (suffixed with the account id) and the CloudFront distribution (a global resource).

## Configure the AWS CLI

Use the default profile.

```bash
aws configure
```

Enter the access key, secret key, `ap-southeast-1`, and `json`. Then verify:

```bash
aws sts get-caller-identity
aws configure get region
```

The account and ARN must be the ones you expect, and the region must print `ap-southeast-1`. Fix the credentials before running any Terraform if not.

The deploy scripts push Docker images, so check ECR login works once. It should print a long token — do not copy it anywhere.

```bash
aws ecr get-login-password --region ap-southeast-1
```

## Local secret files

`.env`, `.env.local`, and `terraform/*/terraform.tfvars` are gitignored. Never commit AWS keys, Clerk secrets, OpenRouter keys, database passwords, Terraform state, or `.terraform` folders.

```bash
cp .env.example .env
```

Fill only the Part 0 values now:

```txt
# PART 0: Initial Setup (guides/0_permissions.md)
AWS_ACCOUNT_ID=123456789012
DEFAULT_AWS_REGION=ap-southeast-1
```

The rest of `.env` fills in phase by phase — values such as `AURORA_CLUSTER_ARN` and `COPILOT_URL` do not exist until a later Terraform apply creates them. Each guide says which section to update, and each guide copies its own `terraform.tfvars.example` when you get there. `frontend/.env.local` comes at guide 6.

## Continue

Ready for `guides/1_sagemaker.md` when `aws sts get-caller-identity`, `aws configure get region`, `terraform version`, and `docker --version` all succeed.
