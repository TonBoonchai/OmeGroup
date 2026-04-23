# 1. IAM Permissions (from earlier)
data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals { type = "Service", identifiers = ["lambda.amazonaws.com"] }
  }
}

resource "aws_iam_role" "chat_lambda_role" {
  name               = "${var.environment_name}-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.chat_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

data "aws_iam_policy_document" "chat_app_policy" {
  statement {
    effect = "Allow"
    actions = ["ivs:CreateStage", "ivs:CreateParticipantToken", "ivs:DeleteStage"]
    resources = ["*"]
  }
  statement {
    effect = "Allow"
    actions = ["execute-api:ManageConnections"]
    resources = ["arn:aws:execute-api:${var.aws_region}:*:*/*/@connections/*"]
  }
}

resource "aws_iam_role_policy" "chat_app_permissions" {
  name   = "${var.environment_name}-app-permissions"
  role   = aws_iam_role.chat_lambda_role.id
  policy = data.aws_iam_policy_document.chat_app_policy.json
}

# 2. The Dummy Lambda Function
resource "aws_lambda_function" "chat_backend" {
  function_name = "${var.environment_name}-backend"
  filename      = "dummy_payload.zip"
  handler       = "main.handler"
  runtime       = "provided.al2023" # Rust compiles to a custom binary on Amazon Linux 2023
  role          = aws_iam_role.chat_lambda_role.arn
  timeout       = 15

  # Attach Lambda to the Private Subnet so it can talk to Redis
  vpc_config {
    subnet_ids         = [aws_subnet.private.id]
    security_group_ids = [aws_security_group.redis_sg.id]
  }

  environment {
    variables = {
      REDIS_URL = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379"
    }
  }
}

# 3. API Gateway & Integrations
resource "aws_apigatewayv2_api" "websocket_api" {
  name                       = "${var.environment_name}-chat-websocket"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
}

resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id           = aws_apigatewayv2_api.websocket_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.chat_backend.invoke_arn
}

# Grant API Gateway permission to trigger your Lambda
resource "aws_lambda_permission" "apigw_lambda" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.chat_backend.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket_api.execution_arn}/*/*"
}

# 4. The Exact Routes ($connect, $disconnect, and swipe)
resource "aws_apigatewayv2_route" "connect_route" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_apigatewayv2_route" "disconnect_route" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_apigatewayv2_route" "swipe_route" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "swipe"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

# 5. Deployment Stage
resource "aws_apigatewayv2_stage" "prod_stage" {
  api_id      = aws_apigatewayv2_api.websocket_api.id
  name        = "production"
  auto_deploy = true
  depends_on = [
    aws_apigatewayv2_route.connect_route,
    aws_apigatewayv2_route.disconnect_route,
    aws_apigatewayv2_route.swipe_route
  ]
}

output "websocket_connection_url" {
  value = aws_apigatewayv2_stage.prod_stage.invoke_url
}

# 1. The Authorizer Lambda Function
resource "aws_lambda_function" "chat_authorizer" {
  function_name = "${var.environment_name}-authorizer"
  # You will deploy the compiled authorizer binary here just like the backend
  filename      = "dummy_payload.zip" 
  handler       = "main.handler"
  runtime       = "provided.al2023"
  role          = aws_iam_role.chat_lambda_role.arn
  
  environment {
    variables = {
      COGNITO_REGION = var.aws_region
      USER_POOL_ID   = aws_cognito_user_pool.chat_users.id
      CLIENT_ID      = aws_cognito_user_pool_client.react_client.id
    }
  }
}

# 2. Grant API Gateway permission to trigger the Authorizer
resource "aws_lambda_permission" "apigw_authorizer" {
  statement_id  = "AllowAuthorizerExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.chat_authorizer.function_name
  principal     = "apigateway.amazonaws.com"
}

# 3. Create the API Gateway Authorizer Entity
resource "aws_apigatewayv2_authorizer" "cognito_authorizer" {
  api_id           = aws_apigatewayv2_api.websocket_api.id
  authorizer_type  = "REQUEST"
  authorizer_uri   = aws_lambda_function.chat_authorizer.invoke_arn
  identity_sources = ["route.request.querystring.token"] # API Gateway explicitly looks here
  name             = "cognito-jwt-authorizer"
}

# 4. CRITICAL: Update the $connect route to USE the Authorizer
# Modify your existing connect_route block to match this:
resource "aws_apigatewayv2_route" "connect_route" {
  api_id             = aws_apigatewayv2_api.websocket_api.id
  route_key          = "$connect"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
  
  # Attach the security checkpoint
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_authorizer.id
}

# The Matchmaker Cron Lambda
resource "aws_lambda_function" "chat_cron" {
  function_name = "${var.environment_name}-cron"
  filename      = "dummy_payload.zip" 
  handler       = "main.handler"
  runtime       = "provided.al2023"
  role          = aws_iam_role.chat_lambda_role.arn
  timeout       = 65 # Must live longer than 1 minute to finish the 12 loops
  
  vpc_config {
    subnet_ids         = [aws_subnet.private.id]
    security_group_ids = [aws_security_group.redis_sg.id]
  }

  environment {
    variables = {
      REDIS_URL = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379"
      WSS_URL   = aws_apigatewayv2_stage.prod_stage.invoke_url # Needs this to push tokens
    }
  }
}

# The EventBridge Trigger (Runs exactly once per minute)
resource "aws_cloudwatch_event_rule" "every_minute" {
  name                = "${var.environment_name}-minute-tick"
  schedule_expression = "rate(1 minute)"
}

resource "aws_cloudwatch_event_target" "trigger_cron" {
  rule      = aws_cloudwatch_event_rule.every_minute.name
  target_id = "MatchmakerCron"
  arn       = aws_lambda_function.chat_cron.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.chat_cron.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.every_minute.arn
}