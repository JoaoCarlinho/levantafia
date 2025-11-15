# Development Environment Configuration

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.tags
  }
}

locals {
  environment = "dev"
}

# Networking
module "networking" {
  source = "../../modules/networking"

  project_name        = var.project_name
  environment         = local.environment
  aws_region          = var.aws_region
  vpc_cidr            = var.vpc_cidr
  az_count            = var.az_count
  single_nat_gateway  = var.single_nat_gateway
  enable_nat_gateway  = var.enable_nat_gateway

  tags = var.tags
}

# Database
module "database" {
  source = "../../modules/database"

  project_name        = var.project_name
  environment         = local.environment
  private_subnet_ids  = module.networking.private_subnet_ids
  db_security_group_id = module.networking.rds_security_group_id

  db_name                  = var.db_name
  db_username              = var.db_username
  db_instance_class        = var.db_instance_class
  db_allocated_storage     = var.db_allocated_storage
  db_max_allocated_storage = var.db_max_allocated_storage
  db_multi_az              = var.db_multi_az
  db_backup_retention_days = var.db_backup_retention_days

  tags = var.tags
}

# Storage
module "storage" {
  source = "../../modules/storage"

  project_name      = var.project_name
  environment       = local.environment
  enable_versioning = var.enable_s3_versioning
  allowed_origins   = var.cors_allowed_origins

  tags = var.tags
}

# Bastion Host (for RDS access via Session Manager)
module "bastion" {
  source = "../../modules/bastion"

  project_name           = var.project_name
  environment            = local.environment
  vpc_id                 = module.networking.vpc_id
  public_subnet_id       = module.networking.public_subnet_ids[0]
  rds_security_group_id  = module.networking.rds_security_group_id
  instance_type          = "t4g.nano"

  tags = var.tags
}

# ECR Repositories
module "ecr" {
  source = "../../modules/ecr"

  project_name = var.project_name
  environment  = local.environment

  tags = var.tags
}

# Application Load Balancer
module "alb" {
  source = "../../modules/alb"

  project_name      = var.project_name
  environment       = local.environment
  vpc_id            = module.networking.vpc_id
  public_subnet_ids = module.networking.public_subnet_ids

  tags = var.tags
}

# ECS Cluster and Services
module "ecs" {
  source = "../../modules/ecs"

  project_name              = var.project_name
  environment               = local.environment
  aws_region                = var.aws_region
  vpc_id                    = module.networking.vpc_id
  private_subnet_ids        = module.networking.private_subnet_ids
  alb_security_group_id     = module.alb.alb_security_group_id
  backend_target_group_arn  = module.alb.backend_target_group_arn
  frontend_target_group_arn = module.alb.frontend_target_group_arn

  # Docker images (will be updated after pushing to ECR)
  backend_image  = "${module.ecr.backend_repository_url}:latest"
  frontend_image = "${module.ecr.frontend_repository_url}:latest"

  # Database configuration
  db_host                 = module.database.db_instance_address
  db_name                 = var.db_name
  db_username             = var.db_username
  db_password_secret_arn  = module.database.db_secret_arn

  # S3 configuration
  s3_bucket_name   = module.storage.photos_bucket_id
  s3_bucket_arn    = module.storage.photos_bucket_arn
  cloudfront_domain = module.storage.cloudfront_distribution_domain_name

  # Backend URL for frontend
  backend_url = "http://${module.alb.alb_dns_name}"

  # CORS configuration
  allowed_origins = join(",", var.cors_allowed_origins)

  tags = var.tags
}
