terraform {
  required_version = ">= 1.10"

  backend "s3" {
    key          = "4_database/terraform.tfstate"
    region       = "ap-southeast-1"
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.28"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

locals {
  prefix = "aluci-aurora"
  common_tags = {
    Project = "aluci"
    Part    = "database"
  }
}

resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_id" "suffix" {
  byte_length = 4
}

resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "${local.prefix}-credentials-${random_id.suffix.hex}"
  recovery_window_in_days = 0

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = aws_rds_cluster.aurora.master_username
    password = random_password.db_password.result
  })
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_db_subnet_group" "aurora" {
  name       = "${local.prefix}-subnet-group"
  subnet_ids = data.aws_subnets.default.ids

  tags = local.common_tags
}

resource "aws_security_group" "aurora" {
  name        = "${local.prefix}-sg"
  description = "Security group for Aluci Aurora cluster"
  vpc_id      = data.aws_vpc.default.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

resource "aws_rds_cluster" "aurora" {
  cluster_identifier = "aluci-aurora-cluster"
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  engine_version     = "15.12"
  database_name      = "aluci"
  master_username    = "aluciadmin"
  master_password    = random_password.db_password.result

  serverlessv2_scaling_configuration {
    min_capacity = var.min_capacity
    max_capacity = var.max_capacity
  }

  enable_http_endpoint = true

  db_subnet_group_name   = aws_db_subnet_group.aurora.name
  vpc_security_group_ids = [aws_security_group.aurora.id]

  skip_final_snapshot = true
  apply_immediately   = true

  tags = local.common_tags
}

resource "aws_rds_cluster_instance" "aurora" {
  identifier         = "${local.prefix}-instance-1"
  cluster_identifier = aws_rds_cluster.aurora.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.aurora.engine

  tags = local.common_tags
}
