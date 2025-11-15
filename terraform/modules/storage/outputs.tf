# Storage Module Outputs

output "photos_bucket_id" {
  description = "ID of the photos S3 bucket"
  value       = aws_s3_bucket.photos.id
}

output "photos_bucket_arn" {
  description = "ARN of the photos S3 bucket"
  value       = aws_s3_bucket.photos.arn
}

output "photos_bucket_domain_name" {
  description = "Domain name of the photos S3 bucket"
  value       = aws_s3_bucket.photos.bucket_domain_name
}

output "cloudfront_distribution_id" {
  description = "ID of CloudFront distribution"
  value       = aws_cloudfront_distribution.photos.id
}

output "cloudfront_distribution_domain_name" {
  description = "Domain name of CloudFront distribution"
  value       = aws_cloudfront_distribution.photos.domain_name
}

output "cloudfront_distribution_arn" {
  description = "ARN of CloudFront distribution"
  value       = aws_cloudfront_distribution.photos.arn
}
