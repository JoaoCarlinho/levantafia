# ==============================================================================
# ECS Module Variables
# ==============================================================================

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "alb_security_group_id" {
  description = "Security group ID of the ALB"
  type        = string
}

variable "backend_target_group_arn" {
  description = "Target group ARN for backend service"
  type        = string
}

variable "frontend_target_group_arn" {
  description = "Target group ARN for frontend service"
  type        = string
}

variable "backend_image" {
  description = "Docker image for backend"
  type        = string
}

variable "frontend_image" {
  description = "Docker image for frontend"
  type        = string
}

variable "db_host" {
  description = "Database host"
  type        = string
}

variable "db_name" {
  description = "Database name"
  type        = string
}

variable "db_username" {
  description = "Database username"
  type        = string
}

variable "db_password_secret_arn" {
  description = "ARN of the secret containing database password"
  type        = string
}

variable "s3_bucket_name" {
  description = "S3 bucket name for photo storage"
  type        = string
}

variable "s3_bucket_arn" {
  description = "S3 bucket ARN"
  type        = string
}

variable "cloudfront_domain" {
  description = "CloudFront distribution domain"
  type        = string
}

variable "backend_url" {
  description = "Backend URL (ALB DNS name)"
  type        = string
}

variable "allowed_origins" {
  description = "Allowed CORS origins for backend"
  type        = string
  default     = "http://localhost:3000,http://localhost:5173"
}

# Backend Service Configuration
variable "backend_cpu" {
  description = "CPU units for backend task (1024 = 1 vCPU)"
  type        = number
  default     = 2048 # 2 vCPU for Java 21 Virtual Threads
}

variable "backend_memory" {
  description = "Memory for backend task (MB)"
  type        = number
  default     = 4096 # 4 GB for high-concurrency uploads
}

variable "backend_desired_count" {
  description = "Desired number of backend tasks"
  type        = number
  default     = 2
}

variable "backend_min_count" {
  description = "Minimum number of backend tasks"
  type        = number
  default     = 2
}

variable "backend_max_count" {
  description = "Maximum number of backend tasks"
  type        = number
  default     = 10
}

# Frontend Service Configuration
variable "frontend_cpu" {
  description = "CPU units for frontend task (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "frontend_memory" {
  description = "Memory for frontend task (MB)"
  type        = number
  default     = 512
}

variable "frontend_desired_count" {
  description = "Desired number of frontend tasks"
  type        = number
  default     = 2
}

variable "frontend_min_count" {
  description = "Minimum number of frontend tasks"
  type        = number
  default     = 2
}

variable "frontend_max_count" {
  description = "Maximum number of frontend tasks"
  type        = number
  default     = 5
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
