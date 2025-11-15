# Terraform Backend Configuration for Development

terraform {
  backend "s3" {
    bucket         = "levantafia-terraform-state"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "levantafia-terraform-locks"

    # Workspace support
    workspace_key_prefix = "workspaces"
  }
}
