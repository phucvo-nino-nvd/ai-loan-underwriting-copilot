terraform {
  required_version = ">= 1.10"

  backend "s3" {
    key          = "1_sagemaker/terraform.tfstate"
    region       = "ap-southeast-1"
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.28"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.12"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

locals {
  classifier_deployed      = var.classifier_image_uri != ""
  classifier_image_version = substr(sha256(var.classifier_image_uri), 0, 12)
}

resource "aws_ecr_repository" "classifier" {
  name         = "aluci-classifier"
  force_delete = true
}

resource "aws_iam_role" "sagemaker_role" {
  name = "aluci-sagemaker-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "sagemaker.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "aluci_sagemaker" {
  name = "aluci_sagemaker"
  role = aws_iam_role.sagemaker_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ]
        Resource = aws_ecr_repository.classifier.arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:DescribeLogStreams",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/sagemaker/*"
      }
    ]
  })
}

resource "aws_sagemaker_model" "classifier_model" {
  count = local.classifier_deployed ? 1 : 0

  name               = "aluci-classifier-model-${local.classifier_image_version}"
  execution_role_arn = aws_iam_role.sagemaker_role.arn

  primary_container {
    image = var.classifier_image_uri
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [aws_iam_role_policy.aluci_sagemaker]
}

resource "aws_sagemaker_endpoint_configuration" "serverless_config" {
  count = local.classifier_deployed ? 1 : 0

  name = "aluci-classifier-config-${local.classifier_image_version}"

  production_variants {
    model_name = aws_sagemaker_model.classifier_model[0].name

    serverless_config {
      memory_size_in_mb = 3072
      max_concurrency   = 2 # Reduced from 10 to avoid quota limit
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Add a delay for IAM role propagation before creating endpoint
resource "time_sleep" "wait_for_iam_propagation" {
  count = local.classifier_deployed ? 1 : 0

  depends_on = [
    aws_iam_role_policy.aluci_sagemaker
  ]

  create_duration = "15s"
}

resource "aws_sagemaker_endpoint" "classifier_endpoint" {
  count = local.classifier_deployed ? 1 : 0

  name                 = "aluci-classifier-endpoint"
  endpoint_config_name = aws_sagemaker_endpoint_configuration.serverless_config[0].name

  depends_on = [
    time_sleep.wait_for_iam_propagation[0]
  ]

}
