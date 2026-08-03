terraform {
  required_version = ">= 1.10"

  backend "s3" {
    key          = "5_api/terraform.tfstate"
    region       = "ap-southeast-1"
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.28"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

locals {
  api_deployed       = var.api_image_uri != ""
  ingest_configured  = var.ingest_function_name != ""
  copilot_configured = var.copilot_url != ""
}

resource "aws_ecr_repository" "api" {
  name         = "aluci-api"
  force_delete = true

  tags = {
    Project = "aluci"
    Part    = "api"
  }
}

resource "aws_iam_role" "api_lambda_role" {
  name = "aluci-api-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Project = "aluci"
    Part    = "api"
  }
}

resource "aws_iam_role_policy_attachment" "api_lambda_basic" {
  role       = aws_iam_role.api_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "api_lambda_policy" {
  name = "aluci-api-lambda-policy"
  role = aws_iam_role.api_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat([
      {
        Effect = "Allow"
        Action = [
          "sagemaker:InvokeEndpoint"
        ]
        Resource = "arn:aws:sagemaker:${var.aws_region}:${data.aws_caller_identity.current.account_id}:endpoint/${var.classifier_endpoint_name}"
      },
      {
        Effect = "Allow"
        Action = [
          "rds-data:ExecuteStatement",
          "rds-data:BatchExecuteStatement",
          "rds-data:BeginTransaction",
          "rds-data:CommitTransaction",
          "rds-data:RollbackTransaction"
        ]
        Resource = var.aurora_cluster_arn
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = var.aurora_secret_arn
      }
      ], local.copilot_configured ? [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunctionUrl",
          "lambda:InvokeFunction"
        ]
        Resource = "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:aluci-copilot"
      }
      ] : [], local.ingest_configured ? [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:${var.ingest_function_name}"
      }
    ] : [])
  })
}

resource "aws_lambda_function" "api" {
  count         = local.api_deployed ? 1 : 0
  function_name = "aluci-api"
  package_type  = "Image"
  image_uri     = var.api_image_uri
  role          = aws_iam_role.api_lambda_role.arn
  timeout       = 300
  memory_size   = 1024

  environment {
    variables = {
      DEFAULT_AWS_REGION       = var.aws_region
      CLASSIFIER_ENDPOINT_NAME = var.classifier_endpoint_name
      COPILOT_URL              = var.copilot_url
      AURORA_CLUSTER_ARN       = var.aurora_cluster_arn
      AURORA_SECRET_ARN        = var.aurora_secret_arn
      AURORA_DATABASE          = var.aurora_database
      CLERK_JWKS_URL           = var.clerk_jwks_url
      INGEST_LAMBDA_NAME       = var.ingest_function_name
      CORS_ORIGINS             = var.cors_origins
    }
  }

  tags = {
    Project = "aluci"
    Part    = "api"
  }
}

resource "aws_lambda_function_url" "api" {
  count              = local.api_deployed ? 1 : 0
  function_name      = aws_lambda_function.api[0].function_name
  authorization_type = var.function_url_auth_type
  invoke_mode        = "RESPONSE_STREAM"
}

resource "aws_lambda_permission" "allow_public_function_url_invoke" {
  count                  = local.api_deployed && var.function_url_auth_type == "NONE" ? 1 : 0
  statement_id           = "AllowPublicFunctionInvokeViaUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.api[0].function_name
  function_url_auth_type = "NONE"
  principal              = "*"
}
