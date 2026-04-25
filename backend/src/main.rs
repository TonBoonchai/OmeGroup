mod handlers;

use aws_sdk_apigatewaymanagement::Client as ApiGwClient;
use aws_sdk_ivsrealtime::Client as IvsClient;
use lambda_http::{run, service_fn, Body, Error, Request, RequestExt, Response};
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .without_time()
        .init();

    let redis_url = std::env::var("REDIS_URL").expect("REDIS_URL must be set");
    let redis_client = redis::Client::open(redis_url)?;

    let shared_config = aws_config::load_from_env().await;

    let endpoint_url = std::env::var("WSS_URL").expect("WSS_URL must be set").replace("wss://", "https://");
    let apigw_config = aws_sdk_apigatewaymanagement::config::Builder::from(&shared_config)
        .endpoint_url(endpoint_url)
        .build();

    let apigw_client = ApiGwClient::from_conf(apigw_config);
    let ivs_client = IvsClient::new(&shared_config);

    run(service_fn(|req| function_handler(&redis_client, &apigw_client, &ivs_client, req))).await
}

async fn function_handler(
    redis_client: &redis::Client,
    apigw_client: &ApiGwClient,
    ivs_client: &IvsClient,
    request: Request,
) -> Result<Response<Body>, Error> {
    let context = match request.request_context() {
        lambda_http::request::RequestContext::WebSocket(ctx) => ctx,
        _ => return Ok(Response::builder().status(400).body("Expected WebSocket context".into()).unwrap()),
    };

    let connection_id = context.connection_id.clone().unwrap_or_default();
    let route_key = context.route_key.clone().unwrap_or_default();

    // On $connect, read username from query string ?username=foo
    let username = request
        .query_string_parameters()
        .first("username")
        .unwrap_or_default()
        .to_string();

    info!("Received route: {} for user: {}", route_key, username);

    let mut con = redis_client.get_async_connection().await?;

    match route_key.as_str() {
        "$connect" => {
            if username.is_empty() {
                return Ok(Response::builder().status(403).body("username required".into()).unwrap());
            }
            let taken = handlers::handle_connect(&mut con, &connection_id, &username).await?;
            if taken {
                return Ok(Response::builder().status(403).body("username taken".into()).unwrap());
            }
        }
        "$disconnect" => handlers::handle_disconnect(&mut con, ivs_client, &connection_id, false).await?,
        "swipe" => handlers::handle_swipe(&mut con, ivs_client, &connection_id).await?,
        "send_message" => handlers::handle_send_message(&mut con, apigw_client, request, &connection_id).await?,
        _ => info!("Unknown route: {}", route_key),
    }

    Ok(Response::builder().status(200).body("{}".into()).unwrap())
}
