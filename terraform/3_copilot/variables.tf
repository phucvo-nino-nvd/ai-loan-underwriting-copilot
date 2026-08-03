variable "aws_region" {
  description = "AWS region for resources"
  type        = string
}

variable "copilot_image_uri" {
  description = "Full ECR image URI for the copilot Lambda container"
  type        = string
  default     = ""
}

variable "openrouter_api_key" {
  description = "OpenRouter API key for the Aluci copilot"
  type        = string
  sensitive   = true
}

variable "langsmith_api_key" {
  description = "LangSmith API key. Empty disables tracing."
  type        = string
  sensitive   = true
  default     = ""
}

variable "langsmith_project" {
  description = "LangSmith project traces are written to"
  type        = string
  default     = "aluci"
}

variable "vector_bucket" {
  description = "S3 Vectors bucket name for policy retrieval"
  type        = string
}

variable "index_name" {
  description = "S3 Vectors index name for policy retrieval"
  type        = string
  default     = "policy-docs"
}
