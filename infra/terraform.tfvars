aws_region           = "us-east-1" # Crucial: US-East-1 has the best IVS feature availability
environment_name     = "class-demo-env"
vpc_cidr             = "10.0.0.0/16"
public_subnet_cidr   = "10.0.1.0/24"
private_subnet_cidr  = "10.0.2.0/24"
availability_zone    = "us-east-1a"
redis_node_type      = "cache.t3.micro" # Cheapest tier to prevent massive AWS bills
redis_engine_version = "7.1"