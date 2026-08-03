# 1. Deploy the SageMaker classifier

This phase creates the ECR repository `aluci-classifier`, the execution role `aluci-sagemaker-role`, and — once the image exists — the SageMaker model, endpoint config, and endpoint.

Terraform runs twice: once to create the base resources, then again from the deploy script with the pushed image URI.

All commands assume you start from the repository root.

## Permission policy

Attach this as an inline policy named `AluciSageMakerPolicy` on the `AluciAccess` group (see `guides/0_permissions.md`). This is the first of six; later guides add theirs alongside it.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadCallerIdentity",
      "Effect": "Allow",
      "Action": "sts:GetCallerIdentity",
      "Resource": "*"
    },
    {
      "Sid": "ManageAluciSageMaker",
      "Effect": "Allow",
      "Action": [
        "sagemaker:CreateModel",
        "sagemaker:DeleteModel",
        "sagemaker:DescribeModel",
        "sagemaker:CreateEndpointConfig",
        "sagemaker:DeleteEndpointConfig",
        "sagemaker:DescribeEndpointConfig",
        "sagemaker:CreateEndpoint",
        "sagemaker:UpdateEndpoint",
        "sagemaker:DeleteEndpoint",
        "sagemaker:DescribeEndpoint",
        "sagemaker:InvokeEndpoint",
        "sagemaker:AddTags",
        "sagemaker:ListTags"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ManageAluciSageMakerRole",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:GetRole",
        "iam:DeleteRole",
        "iam:ListInstanceProfilesForRole",
        "iam:PutRolePolicy",
        "iam:GetRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies",
        "iam:PassRole"
      ],
      "Resource": "arn:aws:iam::*:role/aluci-sagemaker-role"
    },
    {
      "Sid": "ManageAluciClassifierEcr",
      "Effect": "Allow",
      "Action": [
        "ecr:CreateRepository",
        "ecr:DescribeRepositories",
        "ecr:ListTagsForResource",
        "ecr:DeleteRepository",
        "ecr:SetRepositoryPolicy",
        "ecr:GetRepositoryPolicy",
        "ecr:DeleteRepositoryPolicy",
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer"
      ],
      "Resource": "*"
    }
  ]
}
```

`sagemaker:InvokeEndpoint` is there for the smoke test at the end of this guide, and the ECR policy actions are needed because Terraform sets a repository policy.

## Configure local variables

```bash
export AWS_REGION=ap-southeast-1
export AWS_DEFAULT_REGION=ap-southeast-1
cp terraform/1_sagemaker/terraform.tfvars.example terraform/1_sagemaker/terraform.tfvars
```

Fill only the phase 1 values:

```hcl
aws_region = "ap-southeast-1"
classifier_image_uri = ""
```

Leave `classifier_image_uri` empty. The deploy script passes it later with `-var`.

## Phase 1: create ECR and IAM

```bash
cd terraform/1_sagemaker
terraform init
terraform apply
terraform output -raw classifier_ecr_repository_url
```

No SageMaker endpoint exists yet — `classifier_image_uri` is still empty, which is expected. The output should look like:

```txt
123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/aluci-classifier
```

## Phase 2: build, push, deploy the endpoint

From the repository root:

```bash
python backend/classifier/deploy.py
```

The script reads the ECR URL from Terraform output, builds `backend/classifier/Dockerfile` for `linux/amd64`, pushes it, then re-runs Terraform with `classifier_image_uri=<pushed image>` to create the endpoint.

```bash
cd terraform/1_sagemaker
terraform output -raw classifier_endpoint_name   # aluci-classifier-endpoint
```

## Save configuration to .env

In the Part 1 section of your root `.env`, set both `CLASSIFIER_ENDPOINT_NAME` and `SAGEMAKER_ENDPOINT` to the endpoint name above (`aluci-classifier-endpoint`). Leave everything else in that section as `.env.example` ships it.

## Smoke test

```bash
python backend/classifier/test_api.py
```

Expected: a JSON response from SageMaker. The first invoke is slow because the serverless endpoint cold starts.

## Troubleshooting

`AccessDenied` on `iam:PassRole` — the policy must allow passing `arn:aws:iam::<account-id>:role/aluci-sagemaker-role`.

`AccessDenied` from `test_api.py` — the group policy is missing `sagemaker:InvokeEndpoint`.

Docker build or push fails — check Docker is running and `aws ecr get-login-password --region ap-southeast-1` prints a token.

## Continue

After the smoke test works, continue to `guides/2_ingestion.md`.
