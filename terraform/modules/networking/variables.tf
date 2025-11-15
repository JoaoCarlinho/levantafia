# Networking Module Variables

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "levantafia"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones to use"
  type        = number
  default     = 3
  validation {
    condition     = var.az_count >= 2 && var.az_count <= 3
    error_message = "AZ count must be 2 or 3 for high availability."
  }
}

variable "single_nat_gateway" {
  description = "Use a single NAT gateway for all AZs (cost savings for dev)"
  type        = bool
  default     = false
}

variable "enable_nat_gateway" {
  description = "Enable NAT gateway creation. If false, private subnets will route through IGW (dev only)"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
