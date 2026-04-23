# 1. The User Database
resource "aws_cognito_user_pool" "chat_users" {
  name = "${var.environment_name}-user-pool"

  # Users will log in with their email address
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Strict production password policies
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  # Ensure the email is required upon sign-up
  schema {
    attribute_data_type      = "String"
    developer_only_attribute = false
    mutable                  = true
    name                     = "email"
    required                 = true

    string_attribute_constraints {
      min_length = 5
      max_length = 256
    }
  }
}

# 2. The App Client (For React)
resource "aws_cognito_user_pool_client" "react_client" {
  name         = "${var.environment_name}-react-client"
  user_pool_id = aws_cognito_user_pool.chat_users.id

  # We do not generate a client secret because a browser (React) cannot securely hide it
  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]
}

# 3. Output the IDs you need for React
output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.chat_users.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.react_client.id
}