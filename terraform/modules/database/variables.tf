# Database Module Variables

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "levantafia"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "private_subnet_ids" {
  description = "IDs of private subnets for DB subnet group"
  type        = list(string)
}

variable "db_security_group_id" {
  description = "ID of security group for RDS"
  type        = string
}

variable "db_name" {
  description = "Name of the database"
  type        = string
  default     = "levantafia"
}

variable "db_username" {
  description = "Master username for database"
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
  description = "Maximum allocated storage for autoscaling in GB"
  type        = number
  default     = 100
}

variable "db_multi_az" {
  description = "Enable multi-AZ deployment"
  type        = bool
  default     = false
}

variable "db_backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
