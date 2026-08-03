terraform {
  required_version = ">= 1.10"

  backend "s3" {
    key          = "2_ingestion/terraform.tfstate"
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
  ingest_deployed = var.ingest_image_uri != ""
}

resource "aws_s3vectors_vector_bucket" "vectors" {
  vector_bucket_name = "aluci-vectors"
  force_destroy      = true
}

resource "aws_ecr_repository" "ingest" {
  name         = "aluci-ingest"
  force_delete = true

  tags = {
    Project = "aluci"
    Part    = "ingestion"
  }
}

resource "aws_ecr_repository_policy" "ingest_lambda_access" {
  repository = aws_ecr_repository.ingest.name

  policy = jsonencode({
    Version = "2008-10-17"
    Statement = [
      {
        Sid    = "LambdaEcrImageRetrievalPolicy"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = [
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ]
        Condition = {
          ArnLike = {
            "aws:sourceArn" = "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:aluci-ingest"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role" "ingest_lambda_role" {
  name = "aluci-ingest-lambda-role"

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
    Part    = "ingestion"
  }
}

resource "aws_iam_role_policy_attachment" "ingest_lambda_basic" {
  role       = aws_iam_role.ingest_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "ingest_s3vectors_access" {
  name = "aluci-ingest-s3vectors-policy"
  role = aws_iam_role.ingest_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3vectors:CreateIndex",
          "s3vectors:GetIndex",
          "s3vectors:PutVectors",
          "s3vectors:DeleteVectors"
        ]
        Resource = [
          aws_s3vectors_vector_bucket.vectors.vector_bucket_arn,
          "${aws_s3vectors_vector_bucket.vectors.vector_bucket_arn}/index/*"
        ]
      }
    ]
  })
}

resource "aws_lambda_function" "ingest" {
  count         = local.ingest_deployed ? 1 : 0
  function_name = "aluci-ingest"
  package_type  = "Image"
  image_uri     = var.ingest_image_uri
  role          = aws_iam_role.ingest_lambda_role.arn
  timeout       = 300
  memory_size   = 1024
  architectures = ["x86_64"]

  environment {
    variables = {
      OPENROUTER_API_KEY = var.openrouter_api_key
      VECTOR_BUCKET      = aws_s3vectors_vector_bucket.vectors.vector_bucket_name
      INDEX_NAME         = var.index_name
    }
  }

  tags = {
    Project = "aluci"
    Part    = "ingestion"
  }
}
