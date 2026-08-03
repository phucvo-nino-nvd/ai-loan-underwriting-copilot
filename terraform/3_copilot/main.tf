terraform {
  required_version = ">= 1.10"

  backend "s3" {
    key          = "3_copilot/terraform.tfstate"
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
  copilot_deployed = var.copilot_image_uri != ""
}

resource "aws_ecr_repository" "copilot" {
  name         = "aluci-copilot"
  force_delete = true

  tags = {
    Project = "aluci"
    Part    = "copilot"
  }
}

resource "aws_iam_role" "copilot_lambda_role" {
  name = "aluci-copilot-lambda-role"

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
    Part    = "copilot"
  }
}

resource "aws_iam_role_policy_attachment" "copilot_lambda_basic" {
  role       = aws_iam_role.copilot_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "copilot_s3vectors_access" {
  name = "aluci-copilot-s3vectors-policy"
  role = aws_iam_role.copilot_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3vectors:QueryVectors",
          "s3vectors:GetVectors"
        ]
        Resource = "arn:aws:s3vectors:${var.aws_region}:${data.aws_caller_identity.current.account_id}:bucket/${var.vector_bucket}/index/*"
      }
    ]
  })
}

resource "aws_lambda_function" "copilot" {
  count         = local.copilot_deployed ? 1 : 0
  function_name = "aluci-copilot"
  package_type  = "Image"
  image_uri     = var.copilot_image_uri
  role          = aws_iam_role.copilot_lambda_role.arn
  timeout       = 300
  memory_size   = 1024

  ephemeral_storage {
    size = 2048
  }

  environment {
    variables = {
      OPENROUTER_API_KEY = var.openrouter_api_key
      VECTOR_BUCKET      = var.vector_bucket
      INDEX_NAME         = var.index_name

      LANGSMITH_TRACING = var.langsmith_api_key == "" ? "false" : "true"
      LANGSMITH_API_KEY = var.langsmith_api_key
      LANGSMITH_PROJECT = var.langsmith_project
    }
  }

  tags = {
    Project = "aluci"
    Part    = "copilot"
  }
}

resource "aws_lambda_function_url" "copilot" {
  count              = local.copilot_deployed ? 1 : 0
  function_name      = aws_lambda_function.copilot[0].function_name
  authorization_type = "AWS_IAM"
  invoke_mode        = "RESPONSE_STREAM"
}
