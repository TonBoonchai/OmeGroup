use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use aws_lambda_events::apigw::{ApiGatewayCustomAuthorizerRequestTypeRequest, ApiGatewayCustomAuthorizerResponse};
use aws_lambda_events::apigw::{IamPolicyStatement, IamPolicyDocument};
use jsonwebtoken::{decode_header, decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};

// This is the structure of the JWT payload we expect from AWS Cognito
#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String, // The unique User ID
    client_id: String,
    exp: usize,
}

// AWS Cognito exposes its public keys at this specific URL
// You will inject these via Terraform environment variables
async fn fetch_cognito_keys(region: &str, user_pool_id: &str) -> serde_json::Value {
    let url = format!(
        "https://cognito-idp.{}.amazonaws.com/{}/.well-known/jwks.json",
        region, user_pool_id
    );
    reqwest::get(&url).await.unwrap().json().await.unwrap()
}

async fn function_handler(
    event: LambdaEvent<ApiGatewayCustomAuthorizerRequestTypeRequest>,
) -> Result<ApiGatewayCustomAuthorizerResponse, Error> {
    
    // 1. Extract the token from the Query String parameter we sent from React
    let token = event.payload.query_string_parameters.get("token")
        .cloned()
        .unwrap_or_default();

    // Determine the AWS resource the user is trying to access
    let method_arn = event.payload.method_arn.unwrap();
    let is_authorized = validate_token(&token).await;

    // 2. Build the IAM Policy Response
    let effect = if is_authorized { "Allow" } else { "Deny" };
    
    // We use the User ID (sub) as the principal ID if valid, or "unauthorized" if not
    let principal_id = if is_authorized { "authenticated_user".to_string() } else { "unauthorized".to_string() };

    let statement = IamPolicyStatement {
        action: vec!["execute-api:Invoke".to_string()],
        resource: vec![method_arn],
        effect: effect.to_string(),
    };

    let policy_document = IamPolicyDocument {
        version: Some("2012-10-17".to_string()),
        statement: vec![statement],
    };

    Ok(ApiGatewayCustomAuthorizerResponse {
        principal_id,
        policy_document,
        context: Default::default(),
        usage_identifier_key: None,
    })
}

// In a real production app, you would cache the JWKS keys in memory so you don't 
// download them on every single connection, but this is the exact validation logic.
async fn validate_token(token: &str) -> bool {
    if token.is_empty() { return false; }

    let region = std::env::var("COGNITO_REGION").unwrap();
    let pool_id = std::env::var("USER_POOL_ID").unwrap();

    let header = match decode_header(token) {
        Ok(h) => h,
        Err(_) => return false,
    };

    let jwks = fetch_cognito_keys(&region, &pool_id).await;
    
    // Find the matching key ID (kid) in the Cognito JWKS
    let key_to_use = jwks["keys"].as_array().unwrap().iter().find(|k| {
        k["kid"].as_str().unwrap() == header.kid.as_ref().unwrap()
    });

    if let Some(k) = key_to_use {
        let n = k["n"].as_str().unwrap();
        let e = k["e"].as_str().unwrap();
        let decoding_key = DecodingKey::from_rsa_components(n, e).unwrap();
        
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_audience(&[std::env::var("CLIENT_ID").unwrap()]); // Ensure the token belongs to your app
        
        return decode::<Claims>(token, &decoding_key, &validation).is_ok();
    }
    
    false
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(function_handler)).await
}