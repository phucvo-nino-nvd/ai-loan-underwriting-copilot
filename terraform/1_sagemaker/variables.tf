variable "aws_region" {
  description = "AWS region for resources"
  type        = string
}

variable "classifier_image_uri" {
  description = "URI of the classifier Docker image"
  type        = string
  default     = ""
}
