use axum::{Json, extract::State};
use serde::Serialize;

use crate::game_server::state::AppState;

#[derive(Serialize)]
pub struct BotInfoResponse {
    pub bots: Vec<String>,
}

pub async fn ybot_info(
    State(state): State<AppState>
) -> Json<BotInfoResponse> {
    Json(BotInfoResponse {
        bots: state.bots().names(),
    })
}