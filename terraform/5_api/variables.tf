variable "aws_region" {
  description = "AWS region for resources"
  type        = string
}

variable "api_image_uri" {
  description = "Full ECR image URI for the API Lambda container"
  type        = string
  default     = ""
}

variable "classifier_endpoint_name" {
  description = "SageMaker classifier endpoint name"
  type        = string
  default     = ""
}

variable "copilot_url" {
  description = "Public URL of the copilot Lambda function"
  type        = string
  default     = ""
}

variable "aurora_cluster_arn" {
  description = "ARN of the Aurora cluster"
  type        = string
  default     = ""
}

variable "aurora_secret_arn" {
  description = "ARN of the Secrets Manager secret containing database credentials"
  type        = string
  default     = ""
}

variable "aurora_database" {
  description = "Name of the Aurora database"
  type        = string
  default     = "aluci"
}

variable "clerk_jwks_url" {
  description = "Clerk JWKS URL for JWT validation"
  type        = string
  default     = ""
}

variable "ingest_function_name" {
  description = "Internal ingest Lambda function name"
  type        = string
  default     = ""
}

variable "cors_origins" {
  description = "Comma-separated allowed CORS origins"
  type        = string
  default     = "http://localhost:3000"
}

variable "function_url_auth_type" {
  description = "NONE until CloudFront exists (phase 6), then AWS_IAM so only CloudFront can invoke"
  type        = string
  default     = "NONE"
}
