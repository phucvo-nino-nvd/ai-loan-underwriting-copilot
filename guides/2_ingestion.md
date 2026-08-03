# 2. Deploy the ingestion pipeline

This phase creates the S3 Vectors bucket `aluci-vectors`, the ECR repository `aluci-ingest`, the execution role `aluci-ingest-lambda-role`, and — once the image exists — the `aluci-ingest` Lambda.

Terraform runs twice, same as phase 1: base resources first, then again from the deploy script with the pushed image URI.

All commands assume you start from the repository root.

## Permission policy

Add this as an inline policy named `AluciIngestPolicy` on the `AluciAccess` group, alongside `AluciSageMakerPolicy`. Do not replace the earlier policy — the group accumulates.

Replace `673222099674` with your account id and `ap-southeast-1` with your region if they differ.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "UseVectorIndex",
            "Effect": "Allow",
            "Action": [
                "s3vectors:CreateIndex",
                "s3vectors:DeleteIndex",
                "s3vectors:GetIndex",
                "s3vectors:ListIndexes",
                "s3vectors:PutVectors",
                "s3vectors:QueryVectors",
                "s3vectors:GetVectors",
                "s3vectors:DeleteVectors"
            ],
            "Resource": [
                "arn:aws:s3vectors:ap-southeast-1:673222099674:bucket/aluci-vectors",
                "arn:aws:s3vectors:ap-southeast-1:673222099674:bucket/aluci-vectors/index/*"
            ]
        },
        {
            "Sid": "ManageVectorBucket",
            "Effect": "Allow",
            "Action": [
                "s3vectors:CreateVectorBucket",
                "s3vectors:GetVectorBucket",
                "s3vectors:DeleteVectorBucket",
                "s3vectors:ListTagsForResource"
            ],
            "Resource": "arn:aws:s3vectors:ap-southeast-1:673222099674:bucket/aluci-vectors"
        },
        {
            "Sid": "ManageAluciIngestEcr",
            "Effect": "Allow",
            "Action": [
                "ecr:CreateRepository",
                "ecr:DescribeRepositories",
                "ecr:ListTagsForResource",
                "ecr:TagResource",
                "ecr:UntagResource",
                "ecr:DeleteRepository",
                "ecr:SetRepositoryPolicy",
                "ecr:GetRepositoryPolicy",
                "ecr:DeleteRepositoryPolicy",
                "ecr:BatchCheckLayerAvailability",
                "ecr:InitiateLayerUpload",
                "ecr:UploadLayerPart",
                "ecr:CompleteLayerUpload",
                "ecr:PutImage",
                "ecr:BatchGetImage",
                "ecr:GetDownloadUrlForLayer"
            ],
            "Resource": "arn:aws:ecr:ap-southeast-1:673222099674:repository/aluci-ingest"
        },
        {
            "Sid": "ManageAluciIngestRole",
            "Effect": "Allow",
            "Action": [
                "iam:CreateRole",
                "iam:GetRole",
                "iam:DeleteRole",
                "iam:TagRole",
                "iam:UntagRole",
                "iam:ListInstanceProfilesForRole",
                "iam:PutRolePolicy",
                "iam:GetRolePolicy",
                "iam:DeleteRolePolicy",
                "iam:ListRolePolicies",
                "iam:ListAttachedRolePolicies",
                "iam:PassRole"
            ],
            "Resource": "arn:aws:iam::673222099674:role/aluci-ingest-lambda-role"
        },
        {
            "Sid": "AttachLambdaBasicExecution",
            "Effect": "Allow",
            "Action": [
                "iam:AttachRolePolicy",
                "iam:DetachRolePolicy"
            ],
            "Resource": "arn:aws:iam::673222099674:role/aluci-ingest-lambda-role",
            "Condition": {
                "ArnEquals": {
                    "iam:PolicyARN": "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
                }
            }
        },
        {
            "Sid": "ManageAluciIngestLambda",
            "Effect": "Allow",
            "Action": [
                "lambda:CreateFunction",
                "lambda:DeleteFunction",
                "lambda:GetFunction",
                "lambda:GetFunctionConfiguration",
                "lambda:ListVersionsByFunction",
                "lambda:UpdateFunctionCode",
                "lambda:UpdateFunctionConfiguration",
                "lambda:ListTags",
                "lambda:TagResource",
                "lambda:UntagResource",
                "lambda:InvokeFunction"
            ],
            "Resource": "arn:aws:lambda:ap-southeast-1:673222099674:function:aluci-ingest"
        },
        {
            "Sid": "ReadIngestLogs",
            "Effect": "Allow",
            "Action": [
                "logs:DescribeLogGroups",
                "logs:DescribeLogStreams",
                "logs:GetLogEvents",
                "logs:FilterLogEvents"
            ],
            "Resource": "arn:aws:logs:ap-southeast-1:673222099674:log-group:/aws/lambda/aluci-ingest:*"
        }
    ]
}
```

`ReadIngestLogs` earns its place: the API invokes this Lambda with `InvocationType="Event"`, so an upload returns `201 re-indexing started` whether the indexing worked or not. These logs are the only place a failure shows up.

`ecr:GetAuthorizationToken` and `sts:GetCallerIdentity` already come from `AluciSageMakerPolicy`, which is why they are not repeated here.

The `Get*` and `List*` actions are not optional extras. Terraform calls them on every `plan` to refresh state and again on `destroy`, so a policy granting only `Create*`/`Delete*` applies once and then fails the next time you touch the phase.

## Configure local variables

```bash
export AWS_REGION=ap-southeast-1
export AWS_DEFAULT_REGION=ap-southeast-1
cp terraform/2_ingestion/terraform.tfvars.example terraform/2_ingestion/terraform.tfvars
```

Fill the region and the OpenRouter key — copy the key from `OPENROUTER_API_KEY` in the root `.env`:

```hcl
aws_region         = "ap-southeast-1"
openrouter_api_key = "sk-or-..."
```

Both are mandatory. The key is the only way the Lambda ever gets one: `.env*` is in `.dockerignore`, so the `load_dotenv` call in `backend/ingest/ingest.py` finds nothing inside the container and falls back to the environment variable Terraform injects. Leave it out and the Lambda deploys fine, then 401s on every embedding call — uploads still land in Aurora and show up in Settings, but nothing reaches the vector index and the assistant answers "I'm unable to locate any internal policy documents".

The other two variables have safe defaults: `ingest_image_uri` starts empty and `index_name` defaults to `policy-docs`.

## Phase 1: create vector bucket, ECR, and IAM

```bash
cd terraform/2_ingestion
terraform init
terraform apply
terraform output -raw vector_bucket_name    # aluci-vectors
terraform output -raw ecr_repository_url    # ...dkr.ecr.ap-southeast-1.amazonaws.com/aluci-ingest
```

No Lambda exists yet — `ingest_image_uri` is still empty, which is expected.

## Phase 2: build, push, deploy the Lambda

From the repository root:

```bash
python backend/ingest/deploy.py
```

The script reads the ECR URL from Terraform output, builds `backend/ingest/Dockerfile` for `linux/amd64`, pushes it, then re-runs Terraform with `ingest_image_uri=<pushed image>`.

```bash
cd terraform/2_ingestion
terraform output -raw ingest_function_name   # aluci-ingest
```

**Note — not a step, read it before your next `terraform apply` here.** `ingest_image_uri` lives only in that `-var` flag, never in `terraform.tfvars`, and Terraform does not remember it between runs. A bare `terraform apply` in this directory therefore sees an empty value and **destroys the Lambda**. Deploying in order, phase 1 then phase 2, never hits this — it only bites when you come back later to change something.

When you do come back, re-run `python backend/ingest/deploy.py`; it passes the flag for you. Optional shortcut if the only change is a variable such as `openrouter_api_key` and you want to skip the Docker rebuild — reuse the image already deployed:

```bash
terraform apply -var "ingest_image_uri=$(aws lambda get-function \
  --function-name aluci-ingest --query Code.ImageUri --output text)"
```

## Save configuration to .env

In the Part 2 section of your root `.env`, set `VECTOR_BUCKET=aluci-vectors` and `INGEST_LAMBDA_NAME=aluci-ingest` from the outputs above. Leave everything else in that section as `.env.example` ships it.

The API invokes `INGEST_LAMBDA_NAME` to re-index policy documents after an upload. If the value is missing the API still serves requests, but logs a warning and skips re-ingestion.

`OPENROUTER_API_KEY` stays in the Part 3 section of `.env` — the local `test_*.py` scripts and the Copilot use it from there. The deployed Lambda uses the copy in `terraform/2_ingestion/terraform.tfvars` instead. Keep the two in sync; rotating the key means editing both and re-running `terraform apply` here.

Confirm the deployed Lambda actually received it before moving on — an empty value here is invisible until a chat answer comes back empty:

```bash
aws lambda get-function-configuration --function-name aluci-ingest \
  --query 'length(Environment.Variables.OPENROUTER_API_KEY)'
```

## Smoke test

```bash
python backend/ingest/test_ingest.py
python backend/ingest/test_search.py
```

The first loads the markdown knowledge base, chunks it, embeds it through OpenRouter, and writes vectors into `aluci-vectors/policy-docs`. The second queries them back. Both tag the vectors with `clerk_user_id = user_test_underwriter`, because search filters on that field — vectors written without an owner are invisible to every query.

## Troubleshooting

`AccessDenied` on `s3vectors:*` — confirm `AluciIngestPolicy` is on the `AluciAccess` group and that the account id, region, and bucket name in the ARNs match your deployment.

`deploy.py` cannot find the ECR repository URL — re-run the phase 1 apply, or set `INGEST_ECR_REPOSITORY_URL` in `.env` to bypass the Terraform output lookup.

Docker build or push fails — check Docker is running and `aws ecr get-login-password --region ap-southeast-1` prints a token.

OpenRouter authentication error during ingest — `python backend/ingest/test_*.py` reads `OPENROUTER_API_KEY` from the root `.env`, while the deployed Lambda reads the copy Terraform injected from `terraform/2_ingestion/terraform.tfvars`. Fix whichever one failed, and re-run `python backend/ingest/deploy.py` if it was the Lambda.

`test_search.py` prints no results — run `test_ingest.py` first and check it reported a non-zero chunk count.

Uploaded documents appear in Settings but the assistant says it cannot find any policy — the documents reached Aurora and the vector index never did. Check `OPENROUTER_API_KEY` on the Lambda with the command above, then check `ReadIngestLogs` is on the group and read `/aws/lambda/aluci-ingest`. Once the cause is fixed, existing documents are not retried automatically: delete one in Settings and upload it again. Every upload and delete re-indexes the caller's whole active set, so a single round trip repairs all of them.

## Continue

After both smoke tests pass, continue to `guides/3_copilot.md`.
