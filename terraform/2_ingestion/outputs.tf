output "vector_bucket_name" {
  description = "Name of the S3 Vectors bucket"
  value       = aws_s3vectors_vector_bucket.vectors.vector_bucket_name
}

output "ecr_repository_url" {
  description = "ECR repository URL for the ingest Lambda image"
  value       = aws_ecr_repository.ingest.repository_url
}

output "ingest_function_name" {
  description = "Name of the internal ingest Lambda function"
  value       = try(aws_lambda_function.ingest[0].function_name, "Not created yet")
}
