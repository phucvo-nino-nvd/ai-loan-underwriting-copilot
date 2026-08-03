
output "classifier_ecr_repository_url" {
  description = "URL of the classifier ECR repository"
  value       = aws_ecr_repository.classifier.repository_url
}

output "classifier_endpoint_name" {
  description = "Name of the classifier SageMaker endpoint"
  value       = try(aws_sagemaker_endpoint.classifier_endpoint[0].name, "Not created yet - run deploy.py")
}
