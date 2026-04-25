# 1. IAM Permissions
data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
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
  # IVS Permissions
  statement {
    effect    = "Allow"
    actions   = ["ivs:CreateStage", "ivs:CreateParticipantToken", "ivs:DeleteStage"]
    resources = ["*"]
  }
  
  # API Gateway Push Permissions (Allows Rust to push chat to clients)
  statement {
    effect    = "Allow"
    actions   = ["execute-api:ManageConnections"]
    resources = ["arn:aws:execute-api:${var.aws_region}:*:*/*/@connections/*"]
  }

  # DynamoDB Permissions
  statement {
    effect    = "Allow"
    actions   = ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem"]
    resources = [aws_dynamodb_table.users.arn]
  }
}

resource "aws_iam_role_policy" "chat_app_permissions" {
  name   = "${var.environment_name}-app-permissions"
  role   = aws_iam_role.chat_lambda_role.id
  policy = data.aws_iam_policy_document.chat_app_policy.json
}

# 2. Main Backend Lambda
resource "aws_lambda_function" "chat_backend" {
  function_name = "${var.environment_name}-backend"
  filename      = "dummy_payload.zip"
  handler       = "main.handler"
  runtime       = "provided.al2023"
  role          = aws_iam_role.chat_lambda_role.arn
  timeout       = 15

  vpc_config {
    subnet_ids         = [aws_subnet.private.id, aws_subnet.private_2.id]
    security_group_ids = [aws_security_group.lambda_sg.id]
  }

environment {
    variables = {
      REDIS_URL = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379"
      # Break the cycle by constructing the URL manually
      WSS_URL   = "wss://${aws_apigatewayv2_api.websocket_api.id}.execute-api.${var.aws_region}.amazonaws.com/production"
    }
  }
}

# 3. API Gateway Definition
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

resource "aws_lambda_permission" "apigw_lambda" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.chat_backend.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket_api.execution_arn}/*/*"
}

# 4. API Gateway Routes
resource "aws_apigatewayv2_route" "connect_route" {
  api_id             = aws_apigatewayv2_api.websocket_api.id
  route_key          = "$connect"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
  authorization_type = "NONE"
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

resource "aws_apigatewayv2_route" "send_message_route" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "send_message"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

# 6. Deployment Stage
resource "aws_apigatewayv2_stage" "prod_stage" {
  api_id      = aws_apigatewayv2_api.websocket_api.id
  name        = "production"
  auto_deploy = true
  depends_on = [
    aws_apigatewayv2_route.connect_route,
    aws_apigatewayv2_route.disconnect_route,
    aws_apigatewayv2_route.swipe_route,
    aws_apigatewayv2_route.send_message_route
  ]
}

output "websocket_connection_url" {
  value = aws_apigatewayv2_stage.prod_stage.invoke_url
}

# 7. Matchmaker Cron Setup
resource "aws_lambda_function" "chat_cron" {
  function_name = "${var.environment_name}-cron"
  filename      = "dummy_payload.zip" 
  handler       = "main.handler"
  runtime       = "provided.al2023"
  role          = aws_iam_role.chat_lambda_role.arn
  timeout       = 65 
  
  vpc_config {
    subnet_ids         = [aws_subnet.private.id, aws_subnet.private_2.id]
    security_group_ids = [aws_security_group.lambda_sg.id]
  }

  environment {
    variables = {
      REDIS_URL = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379"
      # Break the cycle by constructing the URL manually
      WSS_URL   = "wss://${aws_apigatewayv2_api.websocket_api.id}.execute-api.${var.aws_region}.amazonaws.com/production"
    }
  }
}

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

# Build Rust binaries and upload to Lambda after infra is ready
resource "null_resource" "deploy_lambdas" {
  triggers = {
    # Re-deploy whenever region changes or source code changes
    region      = var.aws_region
    src_hash    = sha1(join("", [for f in fileset("${path.module}/../backend/src", "**/*.rs") : filesha1("${path.module}/../backend/src/${f}")]))
  }

  depends_on = [
    aws_lambda_function.chat_backend,
    aws_lambda_function.chat_cron,
  ]

  provisioner "local-exec" {
    working_dir = "${path.module}/../backend"
    command     = <<-EOT
      set -e
      echo "==> Building Rust Lambdas..."
      cargo lambda build --release

      echo "==> Packaging backend..."
      cd target/lambda/backend
      zip -j bootstrap.zip bootstrap
      aws lambda update-function-code \
        --function-name ${aws_lambda_function.chat_backend.function_name} \
        --zip-file fileb://bootstrap.zip \
        --region ${var.aws_region} \
        --output text
      cd -

      echo "==> Packaging cron..."
      cd target/lambda/cron
      zip -j bootstrap.zip bootstrap
      aws lambda update-function-code \
        --function-name ${aws_lambda_function.chat_cron.function_name} \
        --zip-file fileb://bootstrap.zip \
        --region ${var.aws_region} \
        --output text
      cd -

      echo "==> Lambdas deployed."
    EOT
  }
}