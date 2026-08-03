output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = aws_ecr_repository.copilot.repository_url
}

output "copilot_url" {
  description = "Public HTTPS URL of the copilot Lambda"
  value       = try(aws_lambda_function_url.copilot[0].function_url, "")
}
