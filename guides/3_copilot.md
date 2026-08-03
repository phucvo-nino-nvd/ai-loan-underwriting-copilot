# 3. Deploy the Copilot service

This phase creates the ECR repository `aluci-copilot`, the execution role `aluci-copilot-lambda-role`, and — once the image exists — the `aluci-copilot` Lambda behind a streaming Function URL. The URL is `AWS_IAM`-authorized: callers sign with SigV4, and streaming works exactly as it does with an open URL.

The Copilot calls OpenRouter for LLM responses and queries the S3 Vectors index from phase 2 for policy context.

Terraform runs twice, same as phases 1 and 2: base resources first, then again from the deploy script with the pushed image URI.

All commands assume you start from the repository root.

## Permission policy

Add this as an inline policy named `AluciCopilotPolicy` on the `AluciAccess` group, alongside the earlier ones. Do not replace them — the group accumulates.

Replace `673222099674` with your account id and `ap-southeast-1` with your region if they differ.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "ManageCopilotEcr",
            "Effect": "Allow",
            "Action": [
                "ecr:CreateRepository",
                "ecr:DeleteRepository",
                "ecr:DescribeRepositories",
                "ecr:ListTagsForResource",
                "ecr:TagResource",
                "ecr:UntagResource",
                "ecr:BatchCheckLayerAvailability",
                "ecr:InitiateLayerUpload",
                "ecr:UploadLayerPart",
                "ecr:CompleteLayerUpload",
                "ecr:PutImage",
                "ecr:BatchGetImage",
                "ecr:GetDownloadUrlForLayer"
            ],
            "Resource": "arn:aws:ecr:ap-southeast-1:673222099674:repository/aluci-copilot"
        },
        {
            "Sid": "ManageCopilotIamRole",
            "Effect": "Allow",
            "Action": [
                "iam:CreateRole",
                "iam:DeleteRole",
                "iam:GetRole",
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
            "Resource": "arn:aws:iam::673222099674:role/aluci-copilot-lambda-role"
        },
        {
            "Sid": "AttachLambdaBasicExecution",
            "Effect": "Allow",
            "Action": [
                "iam:AttachRolePolicy",
                "iam:DetachRolePolicy"
            ],
            "Resource": "arn:aws:iam::673222099674:role/aluci-copilot-lambda-role",
            "Condition": {
                "ArnEquals": {
                    "iam:PolicyARN": "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
                }
            }
        },
        {
            "Sid": "ManageCopilotLambda",
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
                "lambda:CreateFunctionUrlConfig",
                "lambda:GetFunctionUrlConfig",
                "lambda:UpdateFunctionUrlConfig",
                "lambda:DeleteFunctionUrlConfig",
                "lambda:InvokeFunctionUrl",
                "lambda:InvokeFunction"
            ],
            "Resource": "arn:aws:lambda:ap-southeast-1:673222099674:function:aluci-copilot"
        },
        {
            "Sid": "ReadCopilotLogs",
            "Effect": "Allow",
            "Action": [
                "logs:DescribeLogGroups",
                "logs:DescribeLogStreams",
                "logs:GetLogEvents",
                "logs:FilterLogEvents"
            ],
            "Resource": "arn:aws:logs:ap-southeast-1:673222099674:log-group:/aws/lambda/aluci-copilot:*"
        }
    ]
}
```

`ecr:GetAuthorizationToken` and `sts:GetCallerIdentity` already come from `AluciSageMakerPolicy`, which is why they are not repeated here.

The Lambda reads S3 Vectors through an inline role policy Terraform creates, not through this one — that is runtime access, separate from these deploy-time grants. It needs both `s3vectors:QueryVectors` and `s3vectors:GetVectors`, because `query_vectors(..., returnMetadata=True)` reads the stored chunk text as a second step.

`lambda:InvokeFunctionUrl` and `lambda:InvokeFunction` are what let the smoke tests below reach the Function URL from your terminal. Both are required: `invoke_mode = "RESPONSE_STREAM"` means a call through the URL is also an invocation of the function, and `InvokeFunctionUrl` alone returns `403` with no hint that the second action is missing. An open URL hides this, because Lambda writes both grants into the function's resource-based policy itself when `authorization_type` is `NONE`. In production the caller is the phase 5 API Lambda, which needs the same pair.

`ReadCopilotLogs` is what lets you tail the function's CloudWatch log group. The Lambda writes there through `AWSLambdaBasicExecutionRole` whether or not you can read it, so without this statement a failure inside the handler is invisible from your terminal.

## Configure local variables

```bash
export AWS_REGION=ap-southeast-1
export AWS_DEFAULT_REGION=ap-southeast-1
cp terraform/3_copilot/terraform.tfvars.example terraform/3_copilot/terraform.tfvars
```

```hcl
aws_region         = "ap-southeast-1"
copilot_image_uri  = ""
openrouter_api_key = "sk-or-v1-..."
langsmith_api_key  = ""
langsmith_project  = "aluci"
vector_bucket      = "aluci-vectors"
index_name         = "policy-docs"
```

Keep `copilot_image_uri` empty for the first apply — the deploy script fills it later. Use the same `openrouter_api_key`, `vector_bucket`, and `index_name` as phase 2. `langsmith_api_key` is optional; see [Enable LangSmith tracing](#enable-langsmith-tracing-optional).

## Phase 1: create ECR and IAM

```bash
cd terraform/3_copilot
terraform init
terraform apply
terraform output -raw ecr_repository_url   # ...dkr.ecr.ap-southeast-1.amazonaws.com/aluci-copilot
```

No Lambda exists yet — `copilot_image_uri` is still empty, which is expected.

## Phase 2: build, push, deploy the Function URL

```bash
python backend/copilot/deploy.py
```

The script reads the ECR URL from Terraform output, builds `backend/copilot/Dockerfile` for `linux/amd64`, pushes it, then re-runs Terraform with `copilot_image_uri=<pushed image>`.

```bash
cd terraform/3_copilot
terraform output -raw copilot_url   # https://abc123.lambda-url.ap-southeast-1.on.aws/
```

## Save configuration to .env

In the Part 3 section of your root `.env`, set `OPENROUTER_API_KEY` to your OpenRouter key — that is the only required value. Leave everything else in that section as `.env.example` ships it.

`COPILOT_URL` is saved in phase 5 when the API service needs it. Until then the Terraform output is the source of truth.

## Smoke test

First confirm the Function URL is closed to anonymous callers:

```bash
COPILOT_URL=$(cd terraform/3_copilot && terraform output -raw copilot_url)
curl -s -o /dev/null -w '%{http_code}\n' "${COPILOT_URL%/}/health"
```

Expected: `403`. An unsigned request is rejected by Lambda before it reaches the application, so every path — `/health` included — needs SigV4. A `200` here means `authorization_type` is still `NONE`.

Then stream a chat response. Both scripts sign with your AWS credentials:

```bash
python backend/copilot/test_tool.py   # policy retrieval from S3 Vectors
python backend/copilot/test_mcp.py    # browser tools via Playwright MCP
```

Both print Server-Sent Event lines from `/chat`. The first should pull policy context if phase 2 ingestion ran; the second should call a browser tool before answering. They send `clerk_user_id` as `user_test_underwriter`, matching `backend/ingest/test_ingest.py`, so the vectors that guide wrote are the ones searched here.

## Enable LangSmith tracing (optional)

Tracing records every model call, tool call, and retrieval, which is the fastest way to see why an answer came out the way it did. Off by default, and no dependency to install — `langsmith` ships with `langchain-core` and reads its own environment variables.

Create an API key at [smith.langchain.com](https://smith.langchain.com) under Settings > API Keys, put it in `terraform/3_copilot/terraform.tfvars`, and apply:

```hcl
langsmith_api_key = "lsv2_pt_..."
langsmith_project = "aluci"
```

```bash
python backend/copilot/deploy.py
```

Go through the deploy script rather than `terraform apply`. `copilot_image_uri` lives in the script's `-var`, not in `terraform.tfvars`, so a bare apply resolves it to `""` and destroys the function.

Terraform derives `LANGSMITH_TRACING` from the key — an empty key disables tracing, a non-empty one enables it. There is no second switch. To trace local runs, mirror the values into `.env` and set `LANGSMITH_TRACING=true` there.

Traces upload from a background thread, and Lambda freezes its sandbox the moment a response finishes streaming. `backend/copilot/server.py` therefore calls `wait_for_all_tracers()` when the SSE stream closes; without it, traces arrive truncated or not at all. The call is a no-op when tracing is off.

Phase 2 is deliberately untraced — its embedding calls are a batch job with nothing to debug per request.

## Troubleshooting

`AccessDenied` on ECR, `iam:PassRole`, or Lambda — confirm `AluciCopilotPolicy` is on the `AluciAccess` group and that the account id and region in the ARNs match your deployment.

Terraform fails attaching `AWSLambdaBasicExecutionRole` — the `AttachLambdaBasicExecution` condition must use the exact ARN `arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`.

`deploy.py` cannot find the ECR repository URL — re-run the phase 1 apply, or set `COPILOT_ECR_REPOSITORY_URL` in `.env`.

Docker build or push fails — check Docker is running and `aws ecr get-login-password --region ap-southeast-1` prints a token.

The chat stream answers `OpenRouter API key is not configured` — fix `openrouter_api_key` in `terraform/3_copilot/terraform.tfvars` and re-run `python backend/copilot/deploy.py`.

Chat answers without policy context, or `retrieve_policy_context` returns `(none)` — confirm phase 2 created `aluci-vectors/policy-docs` and that `vector_bucket` and `index_name` match phase 2. The failure is silent by design in the tool, so read the traceback in CloudWatch.

`403 Forbidden` from the smoke tests — first check your IAM group has both `lambda:InvokeFunctionUrl` and `lambda:InvokeFunction`, and that your shell has credentials; `aws sts get-caller-identity` should print your user. A missing `lambda:InvokeFunction` looks identical to a missing `lambda:InvokeFunctionUrl`. To tell an authorization failure apart from a signing failure, corrupt the signature on purpose — a bad signature answers `InvalidSignatureException` in the `x-amzn-ErrorType` header, while `AccessDeniedException` there means the signature was accepted and IAM said no.

If the grant is there and it still fails, you probably changed `authorization_type` on a URL that already existed. Lambda sets a URL's resource-based policy when the URL is *created* and never revises it afterwards, so an in-place switch leaves the function in a state that denies every caller regardless of identity policy. Recreate the URL instead of updating it:

```bash
cd terraform/3_copilot
terraform apply -replace='aws_lambda_function_url.copilot[0]' \
  -var "copilot_image_uri=$(aws lambda get-function --function-name aluci-copilot --query Code.ImageUri --output text)"
```

This issues a new URL, so anything holding the old one — `COPILOT_URL` in phase 5 — has to be updated.

`422 Unprocessable Entity` from `/chat` — the request is missing `clerk_user_id`. The API Lambda fills it from the verified Clerk token; a hand-written request has to supply it.

No traces in LangSmith — the key only reaches the function on the next apply:

```bash
aws lambda get-function-configuration --function-name aluci-copilot \
  --query 'Environment.Variables.LANGSMITH_TRACING' --output text
```

`false` means `langsmith_api_key` is still empty in `terraform.tfvars`. Traces that stop partway through mean the `wait_for_all_tracers()` flush in `_sse_stream` is gone.

## Continue

Once both chat smoke tests stream an answer, continue to `guides/4_database.md`.
