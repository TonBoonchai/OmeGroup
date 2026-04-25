use aws_sdk_apigatewaymanagement::Client as ApiGwClient;
use aws_sdk_apigatewaymanagement::primitives::Blob;
use aws_sdk_ivsrealtime::Client as IvsClient;
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use redis::AsyncCommands;
use serde_json::Value;
use std::time::Duration;
use tracing::info;

async fn match_one(
    con: &mut redis::aio::Connection,
    ivs_client: &IvsClient,
    apigw_client: &ApiGwClient,
    connection_id: &str,
    stage_arn: &str,
) -> Result<(), Error> {
    let token_res = ivs_client
        .create_participant_token()
        .stage_arn(stage_arn)
        .user_id(connection_id)
        .send()
        .await?;

    let token = token_res.participant_token().unwrap().token().unwrap();

    let user_key = format!("user:{}", connection_id);
    let _: () = con.hset(&user_key, "stage_arn", stage_arn).await?;
    let _: () = con.sadd(format!("room:{}", stage_arn), connection_id).await?;

    let payload = serde_json::json!({
        "type": "match",
        "stageArn": stage_arn,
        "participantToken": token
    });

    let blob = Blob::new(payload.to_string().into_bytes());
    let _ = apigw_client
        .post_to_connection()
        .connection_id(connection_id)
        .data(blob)
        .send()
        .await;

    info!("Matched {} to stage {}", connection_id, stage_arn);
    Ok(())
}

async fn run_matchmaking(
    con: &mut redis::aio::Connection,
    ivs_client: &IvsClient,
    apigw_client: &ApiGwClient,
) -> Result<(), Error> {
    loop {
        // Check for rooms that already have people and have space
        let available_rooms: Vec<String> = redis::cmd("ZRANGEBYSCORE")
            .arg("active_rooms").arg(1).arg(5).arg("LIMIT").arg(0).arg(1)
            .query_async(con).await?;

        if let Some(room) = available_rooms.first() {
            // Room exists with space — pop one user and join them
            let waiting: Option<String> = con.lpop("waiting_queue", None).await?;
            if let Some(connection_id) = waiting {
                let _: i32 = con.zincr("active_rooms", room, 1).await?;
                match_one(con, ivs_client, apigw_client, &connection_id, room).await?;
            } else {
                break; // no users waiting
            }
        } else {
            // No rooms with space — need 2 users to start a new room
            let user1: Option<String> = con.lpop("waiting_queue", None).await?;
            let user2: Option<String> = con.lpop("waiting_queue", None).await?;

            match (user1, user2) {
                (Some(id1), Some(id2)) => {
                    // Create one room for both users
                    let stage = ivs_client.create_stage().name("dynamic-room").send().await?;
                    let new_arn = stage.stage().unwrap().arn().to_string();
                    // Start score at 2 since we're adding 2 users at once
                    let _: () = con.zadd("active_rooms", &new_arn, 2).await?;

                    match_one(con, ivs_client, apigw_client, &id1, &new_arn).await?;
                    match_one(con, ivs_client, apigw_client, &id2, &new_arn).await?;
                }
                (Some(id1), None) => {
                    // Only one user waiting and no rooms — put them back and stop
                    let _: () = redis::cmd("LPUSH")
                        .arg("waiting_queue")
                        .arg(&id1)
                        .query_async(con)
                        .await?;
                    break;
                }
                _ => break,
            }
        }
    }

    Ok(())
}

async fn cron_handler(
    redis_client: &redis::Client,
    ivs_client: &IvsClient,
    apigw_client: &ApiGwClient,
    _event: LambdaEvent<Value>,
) -> Result<(), Error> {
    let mut con = redis_client.get_async_connection().await?;

    for _ in 0..12 {
        run_matchmaking(&mut con, ivs_client, apigw_client).await?;
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
    let apigw_config = aws_sdk_apigatewaymanagement::config::Builder::from(&shared_config)
        .endpoint_url(endpoint_url)
        .build();
    let apigw_client = ApiGwClient::from_conf(apigw_config);

    run(service_fn(|req| cron_handler(&redis_client, &ivs_client, &apigw_client, req))).await
}
