//! Runtime / save-file game state.
//!
//! This matches the TypeScript model in `src/types/game.ts` (lightweight Unit).
//! The richer character model in `models/character.rs` is for later systems —
//! do not plug it into save/load until the frontend sends that shape.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::models::position::Position;

/// Lightweight unit used in saves and the current DevBuild roster.
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Unit {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub sex: String,
    #[serde(default)]
    pub age: u32,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub personality: String,
    #[serde(default)]
    pub temperament: String,
    #[serde(default)]
    pub note: Option<String>,
    pub class: String,
    pub level: u32,
    pub hp: u32,
    pub max_hp: u32,
    #[serde(default)]
    pub position: Position,
    pub allegiance: String,
    #[serde(default)]
    pub relationship: i32,
    #[serde(default)]
    pub arousal: u32,
    #[serde(default)]
    pub stress: u32,
    #[serde(default)]
    pub traits: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct GameState {
    #[serde(default)]
    pub chapter: u32,
    #[serde(default)]
    pub turn: u32,
    #[serde(default)]
    pub phase: String,
    #[serde(default)]
    pub map_id: String,
    #[serde(default)]
    pub units: Vec<Unit>,
    #[serde(default)]
    pub gold: u32,
    /// Party inventory item IDs. Accepts legacy saves that used `inventory`.
    #[serde(default, alias = "inventory")]
    pub caravan: Vec<String>,
    #[serde(default)]
    pub story_flags: HashMap<String, bool>,
    #[serde(default)]
    pub last_autosave: String,
}
