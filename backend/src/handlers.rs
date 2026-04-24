use aws_sdk_apigatewaymanagementapi::Client as ApiGwClient;
use aws_sdk_apigatewaymanagementapi::primitives::Blob;
use aws_sdk_ivsrealtime::Client as IvsClient;
use lambda_http::{Body, Error, Request};
use redis::AsyncCommands;
use serde_json::Value;
use tracing::info;

pub async fn handle_connect(
    con: &mut redis::aio::Connection,
    connection_id: &str,
    user_id: &str,
) -> Result<(), Error> {
    // Map the temporary API Gateway connection ID to the permanent Cognito User ID
    let _: () = con.hset(format!("conn:{}", connection_id), "user_id", user_id).await?;
    
    // Add them to the global matchmaking queue
    let _: () = con.rpush("waiting_queue", connection_id).await?;
    info!("User {} queued for matchmaking.", user_id);
    
    Ok(())
}

pub async fn handle_disconnect(
    con: &mut redis::aio::Connection,
    ivs_client: &IvsClient,
    connection_id: &str,
    is_swipe: bool,
) -> Result<(), Error> {
    let user_key = format!("user:{}", connection_id);
    let stage_arn: Option<String> = con.hget(&user_key, "stage_arn").await?;

    if let Some(arn) = stage_arn {
        let room_key = format!("room:{}", arn);
        
        // Remove user from the room's set
        let _: () = con.srem(&room_key, connection_id).await?;
        
        // Decrement the active participant count and capture the new total
        let current_capacity: i32 = con.zincr("active_rooms", &arn, -1).await?;

        // If the room is empty, destroy the physical AWS resource to stop hourly billing
        if current_capacity <= 0 {
            info!("Room {} is empty. Destroying IVS Stage.", arn);
            let _: () = con.zrem("active_rooms", &arn).await?;
            let _: () = con.del(&room_key).await?;
            let _ = ivs_client.delete_stage().arn(&arn).send().await;
        }
    }

    // Purge user data
    let _: () = con.del(&user_key).await?;
    let _: () = con.del(format!("conn:{}", connection_id)).await?;

    if is_swipe {
        // A swipe immediately throws them back into the waiting pool
        let _: () = con.rpush("waiting_queue", connection_id).await?;
        info!("User {} swiped and re-queued.", connection_id);
    }

    Ok(())
}

pub async fn handle_swipe(
    con: &mut redis::aio::Connection,
    ivs_client: &IvsClient,
    connection_id: &str,
) -> Result<(), Error> {
    // Swiping is logically identical to disconnecting, but triggers the re-queue flag
    handle_disconnect(con, ivs_client, connection_id, true).await
}

pub async fn handle_send_message(
    con: &mut redis::aio::Connection,
    apigw_client: &ApiGwClient,
    request: Request,
    connection_id: &str,
    user_id: &str,
) -> Result<(), Error> {
    if let Body::Text(body_str) = request.body() {
        let body: Value = serde_json::from_str(body_str).unwrap_or_default();
        let text = body["text"].as_str().unwrap_or("");

        if text.is_empty() {
            return Ok(());
        }

        let stage_arn: Option<String> = con.hget(format!("user:{}", connection_id), "stage_arn").await?;
        
        if let Some(arn) = stage_arn {
            // Retrieve everyone currently in this room
            let peers: Vec<String> = con.smembers(format!("room:{}", arn)).await?;
            
            let chat_payload = serde_json::json!({
                "type": "chat",
                "sender": user_id,
                "text": text
            });
            
            let blob = Blob::new(chat_payload.to_string().into_bytes());

            // Push message down the WebSocket to every peer
            for peer_id in peers {
                let _ = apigw_client.post_to_connection()
                    .connection_id(&peer_id)
                    .data(blob.clone())
                    .send().await;
            }
        }
    }
    Ok(())
}