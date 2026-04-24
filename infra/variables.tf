# Core Environment
variable "aws_region" {
  description = "The AWS region to deploy the infrastructure. Must support IVS."
  type        = string
}

variable "environment_name" {
  description = "The name of the deployment environment (e.g., dev, class-demo)"
  type        = string
}

# Network Configuration
variable "vpc_cidr" {
  description = "The core CIDR block for the entire VPC"
  type        = string
}

variable "public_subnet_cidr" {
  description = "The CIDR block for the public subnet housing the NAT Gateway"
  type        = string
}

variable "private_subnet_cidr" {
  description = "The CIDR block for the primary private subnet housing Redis"
  type        = string
}

variable "private_subnet_2_cidr" {
  description = "The CIDR block for the secondary private subnet (Required by ElastiCache)"
  type        = string
}

variable "availability_zone" {
  description = "The primary AZ to pin the subnets to"
  type        = string
}

variable "availability_zone_2" {
  description = "The secondary AZ for ElastiCache high availability"
  type        = string
}

# Database / Caching Configuration
variable "redis_node_type" {
  description = "The hardware spec for the ElastiCache Redis node"
  type        = string
}

variable "redis_engine_version" {
  description = "The version of Redis to deploy"
  type        = string
}