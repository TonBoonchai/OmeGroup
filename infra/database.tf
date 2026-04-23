# database.tf
resource "aws_dynamodb_table" "users" {
  name           = "${var.environment_name}-users"
  billing_mode   = "PAY_PER_REQUEST" # Zero cost when idle
  hash_key       = "user_id"

  attribute {
    name = "user_id"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }
}

# Add IAM Permission for DynamoDB to your existing aws_iam_role_policy in compute.tf
# actions = ["dynamodb:PutItem", "dynamodb:GetItem"]
# resources = [aws_dynamodb_table.users.arn]