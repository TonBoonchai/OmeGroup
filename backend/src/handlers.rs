use aws_sdk_apigatewaymanagement::Client as ApiGwClient;
use aws_sdk_apigatewaymanagement::primitives::Blob;
use aws_sdk_ivsrealtime::Client as IvsClient;
use lambda_http::{Body, Error, Request};
use redis::AsyncCommands;
use serde_json::Value;
use tracing::info;

// Returns true if username was already taken (connection should be rejected)
pub async fn handle_connect(
    con: &mut redis::aio::Connection,
    connection_id: &str,
    username: &str,
) -> Result<bool, Error> {
    // Try to set username key only if it doesn't exist (NX = only if Not eXists)
    let claimed: bool = redis::cmd("SET")
        .arg(format!("username:{}", username))
        .arg(connection_id)
        .arg("NX")
        .query_async(con)
        .await?;

    if !claimed {
        info!("Username {} is already taken.", username);
        return Ok(true);
    }

    // Map connection ID -> username for lookup on disconnect/message
    let _: () = con.hset(format!("conn:{}", connection_id), "username", username).await?;

    // Add to matchmaking queue
    let _: () = con.rpush("waiting_queue", connection_id).await?;
    info!("User {} queued for matchmaking.", username);

    Ok(false)
}

pub async fn handle_disconnect(
    con: &mut redis::aio::Connection,
    ivs_client: &IvsClient,
    connection_id: &str,
    is_swipe: bool,
) -> Result<(), Error> {
    // Free the username so others can take it
    let username: Option<String> = con.hget(format!("conn:{}", connection_id), "username").await?;
    if let Some(name) = &username {
        let _: () = con.del(format!("username:{}", name)).await?;
    }

    let user_key = format!("user:{}", connection_id);
    let stage_arn: Option<String> = con.hget(&user_key, "stage_arn").await?;

    if let Some(arn) = stage_arn {
        let room_key = format!("room:{}", arn);
        let _: () = con.srem(&room_key, connection_id).await?;
        let current_capacity: i32 = con.zincr("active_rooms", &arn, -1).await?;

        if current_capacity <= 0 {
            info!("Room {} is empty. Destroying IVS Stage.", arn);
            let _: () = con.zrem("active_rooms", &arn).await?;
            let _: () = con.del(&room_key).await?;
            let _ = ivs_client.delete_stage().arn(&arn).send().await;
        }
    }

    let _: () = con.del(&user_key).await?;
    let _: () = con.del(format!("conn:{}", connection_id)).await?;

    if is_swipe {
        let _: () = con.rpush("waiting_queue", connection_id).await?;
        info!("User {:?} swiped and re-queued.", username);
    }

    Ok(())
}

pub async fn handle_swipe(
    con: &mut redis::aio::Connection,
    ivs_client: &IvsClient,
    connection_id: &str,
) -> Result<(), Error> {
    handle_disconnect(con, ivs_client, connection_id, true).await
}

pub async fn handle_send_message(
    con: &mut redis::aio::Connection,
    apigw_client: &ApiGwClient,
    request: Request,
    connection_id: &str,
) -> Result<(), Error> {
    if let Body::Text(body_str) = request.body() {
        let body: Value = serde_json::from_str(body_str).unwrap_or_default();
        let text = body["text"].as_str().unwrap_or("");

        if text.is_empty() {
            return Ok(());
        }

        // Look up sender's display name
        let username: String = con
            .hget(format!("conn:{}", connection_id), "username")
            .await
            .unwrap_or_else(|_| "Unknown".to_string());

        let stage_arn: Option<String> = con.hget(format!("user:{}", connection_id), "stage_arn").await?;

        if let Some(arn) = stage_arn {
            let peers: Vec<String> = con.smembers(format!("room:{}", arn)).await?;

            let chat_payload = serde_json::json!({
                "type": "chat",
                "sender": username,
                "text": text
            });

            let blob = Blob::new(chat_payload.to_string().into_bytes());

            for peer_id in peers {
                if peer_id == connection_id { continue; }
                let _ = apigw_client.post_to_connection()
                    .connection_id(&peer_id)
                    .data(blob.clone())
                    .send().await;
            }
        }
    }
    Ok(())
}
