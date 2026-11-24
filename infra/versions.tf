terraform {
  required_version = ">= 1.15"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
    }
  }
}

provider "aws" {
  region = var.region

  # Todo lo que cree Terraform llevará estas etiquetas
  default_tags {
    tags = {
      Project   = "break-my-infra"
      ManagedBy = "terraform"
    }
  }
}