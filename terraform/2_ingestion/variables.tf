variable "aws_region" {
  description = "AWS region for ingestion resources"
  type        = string
}

variable "ingest_image_uri" {
  description = "Full ECR image URI for the ingest Lambda container"
  type        = string
  default     = ""
}

variable "index_name" {
  description = "S3 Vectors index name for policy documents"
  type        = string
  default     = "policy-docs"
}

variable "openrouter_api_key" {
  description = "API key for OpenRouter embeddings"
  type        = string
  sensitive   = true
}
