output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = aws_ecr_repository.api.repository_url
}

output "api_function_url" {
  description = "Public HTTPS Function URL of the API Lambda (supports streaming)"
  value       = try(aws_lambda_function_url.api[0].function_url, "Not created yet")
}

output "api_function_name" {
  description = "Name of the API Lambda function"
  value       = try(aws_lambda_function.api[0].function_name, "Not created yet")
}

