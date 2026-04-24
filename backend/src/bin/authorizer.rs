use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use aws_lambda_events::apigw::{ApiGatewayCustomAuthorizerRequestTypeRequest, ApiGatewayCustomAuthorizerResponse};
use aws_lambda_events::apigw::{IamPolicyStatement, ApiGatewayCustomAuthorizerPolicy};
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
    
    // 1. Extract the token from the Query String parameter (updated to .first())
    let token = event.payload.query_string_parameters.first("token")
        .map(|s| s.to_string())
        .unwrap_or_default();

    let method_arn = event.payload.method_arn.unwrap_or_default();

    if token.is_empty() {
        return Ok(custom_authorizer_response("Deny", "user".to_string(), &method_arn));
    }

    let region = std::env::var("COGNITO_REGION").unwrap();
    let pool_id = std::env::var("USER_POOL_ID").unwrap();

    let header = match decode_header(&token) {
        Ok(h) => h,
        Err(_) => return Ok(custom_authorizer_response("Deny", "user".to_string(), &method_arn)),
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
        validation.set_audience(&[std::env::var("CLIENT_ID").unwrap()]);
        
        if let Ok(token_data) = decode::<Claims>(&token, &decoding_key, &validation) {
            return Ok(custom_authorizer_response("Allow", token_data.claims.sub, &method_arn));
        }
    }

    Ok(custom_authorizer_response("Deny", "user".to_string(), &method_arn))
}

fn custom_authorizer_response(
    effect: &str,
    principal_id: String,
    method_arn: &str,
) -> ApiGatewayCustomAuthorizerResponse {
    let stmt = IamPolicyStatement {
        action: vec!["execute-api:Invoke".to_string()],
        resource: vec![method_arn.to_string()],
        effect: Some(effect.to_string()), // Wrapped in Some()
    };

    let policy_document = ApiGatewayCustomAuthorizerPolicy {
        version: Some("2012-10-17".to_string()),
        statement: vec![stmt],
    };

    ApiGatewayCustomAuthorizerResponse {
        principal_id: Some(principal_id), // Wrapped in Some()
        policy_document,
        context: Default::default(),
        usage_identifier_key: None,
    }
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(function_handler)).await
}