use axum::{extract::State, Json};
use redis::AsyncCommands;
use aws_sdk_ivsrealtime::Client as IvsClient;
use lambda_http::{run, service_fn, Body, Error, Request, RequestExt, Response};
use lambda_http::aws_lambda_events::apigw::ApiGatewayWebsocketProxyRequestContext;
use aws_sdk_apigatewaymanagementapi::Client as ApiGwClient;
use aws_sdk_apigatewaymanagementapi::primitives::Blob;
use redis::AsyncCommands;
use serde_json::Value;

// This is triggered by API Gateway when a user disconnects or swipes
pub async fn handle_disconnect(
    State(redis_client): State<redis::Client>,
    State(ivs_client): State<IvsClient>,
    connection_id: String, // Extracted from API Gateway request context
    is_swipe: bool,
) -> Result<(), String> {
    let mut con = redis_client.get_async_connection().await.unwrap();

    // 1. Find out which room the user was in
    let user_key = format!("user:{}", connection_id);
    let stage_arn: Option<String> = con.hget(&user_key, "stage_arn").await.unwrap();

    if let Some(arn) = stage_arn {
        // 2. Remove user from the room's set
        let room_key = format!("room:{}", arn);
        let _: () = con.srem(&room_key, &connection_id).await.unwrap();

        // 3. Decrement the room's participant count in the Sorted Set
        let current_capacity: i32 = con.zincr(&active_rooms, &arn, -1).await.unwrap();

        // 4. Clean up the user's specific state
        let _: () = con.del(&user_key).await.unwrap();

        // 5. THE DYNAMIC CLEANUP: If the room is empty, destroy the AWS IVS Stage
        // to stop paying hourly costs for an empty room.
        if current_capacity <= 0 {
            let _: () = con.zrem("active_rooms", &arn).await.unwrap();
            let _: () = con.del(&room_key).await.unwrap();
            
            // Delete the physical AWS resource
            let _ = ivs_client.delete_stage().arn(&arn).send().await;
        }
    }

    // 6. If they swiped, immediately throw them back into the waiting queue to find a new room
    if is_swipe {
        let _: () = con.rpush("waiting_queue", &connection_id).await.unwrap();
    }

    Ok(())
}

pub async fn matchmaker_tick(redis_client: &redis::Client, ivs_client: &IvsClient) {
    let mut con = redis_client.get_async_connection().await.unwrap();

    // 1. Check if anyone is waiting
    let waiting_user: Option<String> = con.lpop("waiting_queue", None).await.unwrap();
    
    if let Some(connection_id) = waiting_user {
        // 2. BACKFILL STRATEGY: Find an active room with 1 to 5 people in it.
        // ZRANGEBYSCORE grabs rooms ordered by lowest population first, ensuring we fill empty rooms.
        let available_rooms: Vec<String> = redis::cmd("ZRANGEBYSCORE")
            .arg("active_rooms").arg(1).arg(5).arg("LIMIT").arg(0).arg(1)
            .query_async(&mut con).await.unwrap();

        let target_stage_arn = if let Some(existing_room) = available_rooms.first() {
            // We found a room that someone just left! Increment its capacity.
            let _: () = con.zincr("active_rooms", existing_room, 1).await.unwrap();
            existing_room.clone()
        } else {
            // No available rooms exist. We must provision a brand new AWS IVS Stage.
            let stage = ivs_client.create_stage().name("dynamic-room").send().await.unwrap();
            let new_arn = stage.stage().unwrap().arn().unwrap().to_string();
            
            // Register the new room in Redis with 1 participant
            let _: () = con.zadd("active_rooms", &new_arn, 1).await.unwrap();
            new_arn
        };

        // 3. Generate the actual WebRTC Video Token for this specific user to join the target stage
        let token_response = ivs_client.create_participant_token()
            .stage_arn(&target_stage_arn)
            .user_id(&connection_id)
            .send().await.unwrap();

        let token = token_response.participant_token().unwrap().token().unwrap();
        let participant_id = token_response.participant_token().unwrap().participant_id().unwrap();

        // 4. Map the state in Redis so we can track them when they leave
        let user_key = format!("user:{}", connection_id);
        let _: () = redis::pipe()
            .hset(&user_key, "stage_arn", &target_stage_arn)
            .hset(&user_key, "participant_id", participant_id)
            .sadd(format!("room:{}", target_stage_arn), &connection_id)
            .query_async(&mut con).await.unwrap();

        // 5. Push the IVS Token payload down the API Gateway WebSocket directly to the user
        // (Using aws-sdk-apigatewaymanagementapi)
        send_token_to_client(&connection_id, token).await;
    }
}

use lambda_http::{run, service_fn, Body, Error, Request, RequestExt, Response};
use lambda_http::aws_lambda_events::apigw::ApiGatewayWebsocketProxyRequestContext;
use redis::AsyncCommands;
use tracing::info;
async fn function_handler(
    redis_client: &redis::Client,
    apigw_client: &ApiGwClient,
    request: Request,
) -> Result<Response<Body>, Error> {
    let context = match request.request_context() {
        lambda_http::request::RequestContext::ApiGatewayWebsocket(ctx) => ctx,
        _ => panic!("Expected WebSocket context"),
    };

    let connection_id = context.connection_id.unwrap_or_default();
    let route_key = context.route_key.unwrap_or_default();
    
    // Extract the Cognito User ID verified by your Custom Authorizer
    let user_id = context.authorizer.unwrap().principal_id;
    let mut con = redis_client.get_async_connection().await?;

    match route_key.as_str() {
        "$connect" => {
            // Map the AWS connection ID to the real User ID in Redis
            let _: () = con.hset(format!("conn:{}", connection_id), "user_id", &user_id).await?;
            let _: () = con.rpush("waiting_queue", &connection_id).await?;
        }
        "$disconnect" => {
            let user_key = format!("user:{}", connection_id);
            let stage_arn: Option<String> = con.hget(&user_key, "stage_arn").await.unwrap_or(None);
            
            if let Some(arn) = stage_arn {
                let room_key = format!("room:{}", arn);
                let _: () = con.srem(&room_key, &connection_id).await?;
                let _: () = con.zincr("active_rooms", &arn, -1).await?;
            }
            let _: () = con.del(&user_key).await?;
            let _: () = con.del(format!("conn:{}", connection_id)).await?;
        }
        "swipe" => {
            let _: () = con.rpush("waiting_queue", &connection_id).await?;
        }
        "send_message" => {
            // THE CHAT ROUTER: Broadcasts message to everyone in the same stage
            if let Ok(body_bytes) = request.body() {
                let body: Value = serde_json::from_slice(body_bytes).unwrap_or_default();
                let text = body["text"].as_str().unwrap_or("");

                let stage_arn: Option<String> = con.hget(format!("user:{}", connection_id), "stage_arn").await?;
                
                if let Some(arn) = stage_arn {
                    // Get all connection IDs currently in this room
                    let peers: Vec<String> = con.smembers(format!("room:{}", arn)).await?;
                    
                    let chat_payload = serde_json::json!({
                        "type": "chat",
                        "sender": user_id, // Shows who sent it
                        "text": text
                    });
                    
                    let blob = Blob::new(chat_payload.to_string().into_bytes());

                    // Push the text to everyone's screen
                    for peer_id in peers {
                        let _ = apigw_client.post_to_connection()
                            .connection_id(&peer_id)
                            .data(blob.clone())
                            .send().await;
                    }
                }
            }
        }
        _ => {}
    }

    Ok(Response::builder().status(200).body("{}".into()).unwrap())
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let redis_url = std::env::var("REDIS_URL").unwrap();
    let redis_client = redis::Client::open(redis_url)?;
    
    // Initialize the API Gateway client to push messages back down the pipe
    let shared_config = aws_config::load_from_env().await;
    let endpoint_url = std::env::var("WSS_URL").unwrap().replace("wss://", "https://");
    let apigw_config = aws_sdk_apigatewaymanagementapi::config::Builder::from(&shared_config)
        .endpoint_url(endpoint_url)
        .build();
    let apigw_client = ApiGwClient::from_conf(apigw_config);

    run(service_fn(|req| function_handler(&redis_client, &apigw_client, req))).await
}