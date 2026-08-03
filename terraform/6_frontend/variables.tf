variable "aws_region" {
  description = "AWS region for resources"
  type        = string
}

variable "state_bucket" {
  description = "S3 bucket holding the Terraform state of every phase; this phase reads the API Function URL out of phase 5's"
  type        = string
}
