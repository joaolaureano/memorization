terraform {
  required_version = ">= 1.11"

  required_providers {
    # 6.x: primeira linha com runtime nodejs24.x (e ja tem value_wo no SSM)
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }

    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }

    # zipa a Lambda stub enquanto o handler real nao existe no backend
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = var.project_name
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}
