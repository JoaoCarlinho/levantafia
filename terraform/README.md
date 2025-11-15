# Levantafia Infrastructure - Terraform

This directory contains Terraform configurations for provisioning and managing the Levantafia photo upload system infrastructure on AWS.

## Architecture

The infrastructure is organized into reusable modules:

- **networking**: VPC, subnets, NAT gateways, security groups
- **database**: RDS PostgreSQL with automated backups
- **cache**: ElastiCache Redis (to be added)
- **storage**: S3 buckets with CloudFront CDN
- **ecs-fargate**: ECS cluster, ALB, auto-scaling (to be added)
- **monitoring**: CloudWatch dashboards and alarms (to be added)

## Prerequisites

1. **Terraform**: Version 1.6.0 or higher
   ```bash
   # Install via Homebrew (macOS)
   brew install terraform

   # Or download from https://www.terraform.io/downloads
   ```

2. **AWS CLI**: Configured with appropriate credentials
   ```bash
   aws configure
   # Enter your AWS Access Key ID, Secret Access Key, and region
   ```

3. **AWS Permissions**: Your AWS user/role needs permissions to create:
   - VPC, subnets, route tables, NAT gateways
   - RDS instances
   - S3 buckets
   - CloudFront distributions
   - ECS clusters and services (future)
   - IAM roles and policies

## Initial Setup

### 1. Create Terraform State Backend

Before using Terraform, create the S3 bucket and DynamoDB table for state management:

```bash
# Create S3 bucket for state
aws s3 mb s3://levantafia-terraform-state --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket levantafia-terraform-state \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket levantafia-terraform-state \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Block public access
aws s3api put-public-access-block \
  --bucket levantafia-terraform-state \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name levantafia-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### 2. Initialize Development Environment

```bash
cd terraform/environments/dev

# Initialize Terraform
terraform init

# Validate configuration
terraform validate

# Format code
terraform fmt -recursive

# Preview changes
terraform plan

# Apply changes (with confirmation)
terraform apply

# Or apply without prompting (use with caution)
terraform apply -auto-approve
```

## Project Structure

```
terraform/
├── environments/
│   ├── dev/                        # Development environment
│   │   ├── backend.tf              # S3 backend configuration
│   │   ├── main.tf                 # Main environment config
│   │   ├── variables.tf            # Environment-specific variables
│   │   ├── outputs.tf              # Environment outputs
│   │   └── terraform.tfvars        # Variable values (gitignored)
│   ├── staging/                    # Staging environment (to be added)
│   └── prod/                       # Production environment (to be added)
├── modules/
│   ├── networking/                 # VPC and network resources
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── README.md
│   ├── database/                   # RDS PostgreSQL
│   ├── cache/                      # ElastiCache Redis (to be added)
│   ├── storage/                    # S3 and CloudFront
│   ├── ecs-fargate/                # ECS cluster and services (to be added)
│   └── monitoring/                 # CloudWatch (to be added)
├── .terraform-version              # Terraform version constraint
├── .gitignore
└── README.md                       # This file
```

## Common Commands

### Initialization

```bash
# Initialize (run once, or after adding new modules)
terraform init

# Upgrade providers
terraform init -upgrade
```

### Planning and Applying

```bash
# Preview changes
terraform plan

# Save plan to file
terraform plan -out=tfplan

# Apply saved plan
terraform apply tfplan

# Apply directly (requires confirmation)
terraform apply

# Auto-approve (careful!)
terraform apply -auto-approve
```

### State Management

```bash
# List all resources
terraform state list

# Show specific resource
terraform state show aws_vpc.main

# Pull current state
terraform state pull

# Refresh state from actual infrastructure
terraform refresh
```

### Outputs

```bash
# Show all outputs
terraform output

# Show specific output
terraform output vpc_id

# Output in JSON format
terraform output -json
```

### Validation and Formatting

```bash
# Validate syntax
terraform validate

# Format code
terraform fmt -recursive

# Check formatting
terraform fmt -check -recursive
```

### Destruction

```bash
# Preview what will be destroyed
terraform plan -destroy

# Destroy infrastructure
terraform destroy

# Destroy specific resource
terraform destroy -target=aws_instance.example
```

## Environment-Specific Deployment

### Development

```bash
cd terraform/environments/dev
terraform init
terraform plan
terraform apply
```

### Staging

```bash
cd terraform/environments/staging
terraform init
terraform workspace select staging  # or terraform workspace new staging
terraform plan
terraform apply
```

### Production

```bash
cd terraform/environments/prod
terraform init
terraform workspace select prod
terraform plan -out=tfplan

# Review plan carefully!
# Requires manual approval

terraform apply tfplan
```

## Using Workspaces

Terraform workspaces allow managing multiple environments with the same configuration:

```bash
# List workspaces
terraform workspace list

# Create new workspace
terraform workspace new dev

# Switch workspace
terraform workspace select dev

# Show current workspace
terraform workspace show

# Delete workspace (must be empty)
terraform workspace delete dev
```

## Module Development

When creating or modifying modules:

1. **Create module directory** under `modules/`
2. **Add required files**:
   - `main.tf` - Main resources
   - `variables.tf` - Input variables
   - `outputs.tf` - Output values
   - `README.md` - Module documentation

3. **Test the module**:
   ```bash
   cd terraform/environments/dev
   terraform init
   terraform validate
   terraform plan
   ```

4. **Document inputs and outputs** in README.md

## Cost Estimation

Use Infracost to estimate costs before applying:

```bash
# Install Infracost
brew install infracost

# Generate cost estimate
infracost breakdown --path terraform/environments/dev

# Compare with baseline
infracost diff --path terraform/environments/dev
```

**Estimated Monthly Costs**:
- **Development**: ~$150/month
  - VPC: Free
  - NAT Gateway (1): ~$32/month
  - RDS t4g.micro: ~$15/month
  - S3 + CloudFront: ~$20/month
  - Data transfer: ~$10/month

- **Production**: ~$800-1000/month
  - VPC: Free
  - NAT Gateways (3): ~$96/month
  - RDS t4g.small Multi-AZ: ~$60/month
  - ECS Fargate: ~$200/month
  - S3 + CloudFront: ~$100/month
  - ElastiCache: ~$30/month
  - Data transfer: ~$200/month

## Security Best Practices

1. **Never commit secrets**
   - Use AWS Secrets Manager for sensitive data
   - Secrets are auto-generated (database passwords)
   - Reference secrets via ARN in application

2. **State file security**
   - State stored in S3 with encryption
   - Access controlled via IAM
   - State locking via DynamoDB

3. **Resource tagging**
   - All resources tagged with Environment, Project, ManagedBy
   - Enables cost tracking and organization

4. **Least privilege IAM**
   - Task roles have minimal required permissions
   - No hardcoded credentials

## Troubleshooting

### Issue: "Error locking state"

```bash
# If state is locked and you're sure no other operation is running:
terraform force-unlock <LOCK_ID>
```

### Issue: "Backend configuration changed"

```bash
# Reinitialize backend
terraform init -reconfigure
```

### Issue: "Resource already exists"

```bash
# Import existing resource
terraform import aws_vpc.main vpc-xxxxx

# Or remove from state and recreate
terraform state rm aws_vpc.main
terraform apply
```

### Issue: "Provider plugin not found"

```bash
# Reinstall providers
rm -rf .terraform
terraform init
```

## CI/CD Integration

Terraform is integrated with GitHub Actions:

- **Pull Requests**: Automatic `terraform plan` and comment on PR
- **Main branch**: Auto-deploy to development
- **Production**: Manual approval required

See [`.github/workflows/terraform.yml`](../../.github/workflows/terraform.yml) for details.

## Terraform Best Practices

1. ✅ **Use modules** for reusability
2. ✅ **Version pin providers** to avoid surprises
3. ✅ **Enable remote state** with locking
4. ✅ **Tag all resources** for organization
5. ✅ **Run `terraform plan`** before every apply
6. ✅ **Use variables** instead of hardcoding
7. ✅ **Document modules** with README
8. ✅ **Format code** with `terraform fmt`
9. ✅ **Validate** with `terraform validate`
10. ✅ **Review state** regularly with `terraform state list`

## Additional Tools

- **tflint**: Linter for Terraform
  ```bash
  brew install tflint
  tflint
  ```

- **tfsec**: Security scanner
  ```bash
  brew install tfsec
  tfsec .
  ```

- **terraform-docs**: Generate documentation
  ```bash
  brew install terraform-docs
  terraform-docs markdown table . > README.md
  ```

- **terratest**: Integration testing (Go-based)

## Support

- **Terraform Documentation**: https://www.terraform.io/docs
- **AWS Provider Docs**: https://registry.terraform.io/providers/hashicorp/aws/latest/docs
- **Terraform Best Practices**: https://www.terraform-best-practices.com/

## Changelog

- **2025-11-10**: Initial Terraform setup with networking, database, and storage modules
- **Next**: Add ECS Fargate, ElastiCache Redis, and monitoring modules

## License

This infrastructure code is part of the Levantafia project.
