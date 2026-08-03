output "cloudfront_url" {
  description = "Public HTTPS URL of the frontend CloudFront distribution"
  value       = "https://${aws_cloudfront_distribution.main.domain_name}"
}

output "distribution_id" {
  description = "CloudFront distribution id, for cache invalidation after a deploy"
  value       = aws_cloudfront_distribution.main.id
}

output "s3_bucket" {
  description = "Name of the S3 bucket hosting the static frontend"
  value       = aws_s3_bucket.frontend.id
}
