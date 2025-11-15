# Development Environment Variables

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "levantafia"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# Networking Variables
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones"
  type        = number
  default     = 2
}

variable "single_nat_gateway" {
  description = "Use single NAT gateway (cost savings for dev)"
  type        = bool
  default     = true
}

variable "enable_nat_gateway" {
  description = "Enable NAT gateway creation"
  type        = bool
  default     = false  # Disabled by default for dev due to AWS limits
}

# Database Variables
variable "db_name" {
  description = "Database name"
  type        = string
  default     = "levantafia"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "levantafia_admin"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum allocated storage in GB"
  type        = number
  default     = 50
}

variable "db_multi_az" {
  description = "Enable multi-AZ"
  type        = bool
  default     = false
}

variable "db_backup_retention_days" {
  description = "Backup retention in days"
  type        = number
  default     = 1
}

# Storage Variables
variable "enable_s3_versioning" {
  description = "Enable S3 versioning"
  type        = bool
  default     = true
}

variable "cors_allowed_origins" {
  description = "Allowed origins for CORS"
  type        = list(string)
  default     = ["http://localhost:3000", "http://localhost:5173"]
}

# Tags
variable "tags" {
  description = "Default tags"
  type        = map(string)
  default = {
    Environment = "dev"
    Project     = "Levantafia"
    ManagedBy   = "Terraform"
  }
}
