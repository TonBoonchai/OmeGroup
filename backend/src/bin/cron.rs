use aws_sdk_apigatewaymanagementapi::Client as ApiGwClient;
use aws_sdk_apigatewaymanagementapi::primitives::Blob;
use aws_sdk_ivsrealtime::Client as IvsClient;
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use redis::AsyncCommands;
use serde_json::Value;
use std::time::Duration;
use tracing::info;

async fn cron_handler(
    redis_client: &redis::Client,
    ivs_client: &IvsClient,
    apigw_client: &ApiGwClient,
    _event: LambdaEvent<Value>,
) -> Result<(), Error> {
    let mut con = redis_client.get_async_connection().await?;

    // Loop 12 times with a 5-second sleep for sub-minute matchmaking
    for _ in 0..12 {
        let waiting_user: Option<String> = con.lpop("waiting_queue", None).await?;
        
        if let Some(connection_id) = waiting_user {
            info!("Matchmaking user: {}", connection_id);
            
            // Find a room with 1 to 5 people
            let available_rooms: Vec<String> = redis::cmd("ZRANGEBYSCORE")
                .arg("active_rooms").arg(1).arg(5).arg("LIMIT").arg(0).arg(1)
                .query_async(&mut con).await?;

            let target_stage_arn = if let Some(room) = available_rooms.first() {
                // Return type explicitly declared to fix trait bound error
                let _: i32 = con.zincr("active_rooms", room, 1).await?;
                room.clone()
            } else {
                let stage = ivs_client.create_stage().name("dynamic-room").send().await?;
                let new_arn = stage.stage().unwrap().arn().unwrap().to_string();
                let _: () = con.zadd("active_rooms", &new_arn, 1).await?;
                new_arn
            };

            // Generate Video Token
            let token_res = ivs_client.create_participant_token()
                .stage_arn(&target_stage_arn)
                .user_id(&connection_id)
                .send().await?;

            let token = token_res.participant_token().unwrap().token().unwrap();
            
            // Map state in Redis
            let user_key = format!("user:{}", connection_id);
            let _: () = con.hset(&user_key, "stage_arn", &target_stage_arn).await?;
            let _: () = con.sadd(format!("room:{}", target_stage_arn), &connection_id).await?;

            // Push the video token down the WebSocket to React
            let payload = serde_json::json!({
                "type": "match",
                "stageArn": target_stage_arn,
                "participantToken": token
            });
            
            let blob = Blob::new(payload.to_string().into_bytes());
            
            let _ = apigw_client.post_to_connection()
                .connection_id(&connection_id)
                .data(blob)
                .send().await;
        }
        
        tokio::time::sleep(Duration::from_secs(5)).await;
    }

    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt().with_max_level(tracing::Level::INFO).without_time().init();

    let redis_url = std::env::var("REDIS_URL").expect("REDIS_URL missing");
    let redis_client = redis::Client::open(redis_url)?;
    
    let shared_config = aws_config::load_from_env().await;
    let ivs_client = IvsClient::new(&shared_config);
    
    let endpoint_url = std::env::var("WSS_URL").expect("WSS_URL missing").replace("wss://", "https://");
    let apigw_config = aws_sdk_apigatewaymanagementapi::config::Builder::from(&shared_config)
        .endpoint_url(endpoint_url)
        .build();
    let apigw_client = ApiGwClient::from_conf(apigw_config);

    run(service_fn(|req| cron_handler(&redis_client, &ivs_client, &apigw_client, req))).await
}