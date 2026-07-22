use serde::{Deserialize, Serialize};
use crate::models::{character::Unit, item::Item};

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct GameState {
    pub chapter: u32,
    pub turn: u32,
    pub phase: String,
    pub map_id: String,
    pub units: Vec<Unit>,
    pub items: Vec<Item>,
    pub gold: u32,
    pub inventory: Vec<String>,
    pub story_flags: std::collections::HashMap<String, bool>,
    pub last_autosave: String,
}