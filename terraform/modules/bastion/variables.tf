# Bastion Module Variables

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where bastion will be deployed"
  type        = string
}

variable "public_subnet_id" {
  description = "Public subnet ID for bastion host"
  type        = string
}

variable "rds_security_group_id" {
  description = "RDS security group ID to allow access from bastion"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type for bastion"
  type        = string
  default     = "t4g.nano"
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
