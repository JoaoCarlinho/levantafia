# Development Environment Outputs

# Networking Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.networking.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.networking.private_subnet_ids
}

# Database Outputs
output "db_endpoint" {
  description = "Database endpoint"
  value       = module.database.db_instance_endpoint
  sensitive   = true
}

output "db_secret_arn" {
  description = "ARN of Secrets Manager secret with DB credentials"
  value       = module.database.db_secret_arn
}

# Storage Outputs
output "photos_bucket_name" {
  description = "Name of photos S3 bucket"
  value       = module.storage.photos_bucket_id
}

output "cloudfront_domain" {
  description = "CloudFront distribution domain"
  value       = module.storage.cloudfront_distribution_domain_name
}

# Connection strings for application
output "database_url" {
  description = "Database connection URL (use secret_arn instead)"
  value       = "postgresql://${module.database.db_instance_address}:${module.database.db_instance_port}/${module.database.db_name}"
  sensitive   = true
}

# Bastion Host Outputs
output "bastion_instance_id" {
  description = "Instance ID of the bastion host (for Session Manager)"
  value       = module.bastion.bastion_instance_id
}

output "bastion_private_ip" {
  description = "Private IP of the bastion host"
  value       = module.bastion.bastion_private_ip
}
