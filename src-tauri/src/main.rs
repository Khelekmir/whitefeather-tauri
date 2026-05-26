#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// ### STRUCTS ###
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Position {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Unit {
    pub id: String,
    pub name: String,
    pub class: String,
    pub level: u32,
    pub hp: u32,
    pub maxHp: u32,
    pub position: Position,
    pub allegiance: String,
    pub relationship: i32,
    pub arousal: u32,
    pub stress: u32,
    pub traits: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct GameState {
    pub chapter: u32,
    pub turn: u32,
    pub phase: String,
    pub mapId: String,
    pub units: Vec<Unit>,
    pub gold: u32,
    pub inventory: Vec<String>,
    pub storyFlags: std::collections::HashMap<String, bool>,
    pub lastAutosave: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct CombatBonus {
    pub chance: ChanceBonus,
    pub value: ValueBonus,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ChanceBonus {
    pub parry: f64,
    pub dodge: f64,
    pub block: f64,
    pub hit: f64,
    pub critical: f64,
    pub resist: Option<std::collections::HashMap<String, f64>>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ValueBonus {
    pub block: f64,
    pub damage: f64,
    pub critical: f64,
    pub effective_multiplier: f64,
    pub armor: Option<f64>,
    pub resist: Option<std::collections::HashMap<String, f64>>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct LewdBonus {
    pub bonus: LewdStats,
    pub soiled: Option<SoiledStats>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct LewdStats {
    pub allure: f64,
    pub charisma: f64,
    pub libido: f64,
    pub dominance: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SoiledStats {
    pub blood: f64,
    pub sweat: f64,
    pub semen: f64,
    pub urine: f64,
    pub vaginal_discharge: f64,
    pub arousal_fluid: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ItemFlags {
    pub starter: Option<String>,
    pub prf: Option<Vec<String>>,
    pub effective: Option<std::collections::HashMap<String, bool>>,
    pub indestructible: Option<bool>,
    pub unequipped: Option<bool>,
    pub two_hand_optional: Option<bool>,
    // ... add others as needed
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    pub template_id: String,
    pub item_type: String,
    pub name: String,
    pub slot: String,
    pub description: String,

    pub combat_stats: CombatBonus,
    pub lewd_stats: LewdBonus,
    pub flags: ItemFlags,
    pub misc: Option<std::collections::HashMap<String, serde_json::Value>>,

    pub durability: u32,
    pub max_durability: u32,
    pub owner_id: Option<String>,
    pub equipped_slot: Option<String>,
}

// ### GAME FUNCTIONS ###
#[tauri::command]
fn save_game_autosave(app: AppHandle, state: GameState) -> Result<(), String> {
    let saves_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("saves");

    fs::create_dir_all(&saves_dir).map_err(|e| e.to_string())?;

    let file_path = saves_dir.join("autosave.json");
    let json = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;

    fs::write(&file_path, json).map_err(|e| e.to_string())?;
    println!("✅ Game saved: {}", file_path.display());
    Ok(())
}

#[tauri::command]
fn load_game(app: AppHandle, filename: Option<String>) -> Result<GameState, String> {
    let saves_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("saves");

    let file_path = match filename {
        Some(name) => {
            // Load a specific save file
            let clean_name = if name.ends_with(".json") {
                name
            } else {
                format!("{}.json", name)
            };
            saves_dir.join(clean_name)
        }
        None => {
            // Load the rolling autosave
            saves_dir.join("autosave.json")
        }
    };

    if !file_path.exists() {
        println!("⚠️ Save file not found: {}", file_path.display());
        return Ok(GameState::default());
    }

    let json = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let state: GameState = serde_json::from_str(&json).map_err(|e| e.to_string())?;

    println!("✅ Game loaded: {}", file_path.display());
    Ok(state)
}

#[tauri::command]
fn delete_game(app: AppHandle, filename: String) -> Result<(), String> {
    let saves_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("saves");

    let file_path = saves_dir.join(filename);
    fs::remove_file(&file_path).map_err(|e| e.to_string())?;
    println!("✅ Game deleted: {}", file_path.display());
    Ok(())
}

#[tauri::command]
fn save_game_manual(app: AppHandle, filename: String, state: GameState) -> Result<(), String> {
    let saves_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("saves");

    fs::create_dir_all(&saves_dir).map_err(|e| e.to_string())?;

    let file_path = saves_dir.join(filename);
    let json = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;

    fs::write(&file_path, json).map_err(|e| e.to_string())?;
    println!("✅ Saved to: {}", file_path.display());
    Ok(())
}

#[tauri::command]
fn list_saves(app: AppHandle) -> Result<Vec<String>, String> {
    let saves_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("saves");

    if !saves_dir.exists() {
        return Ok(vec![]);
    }

    let mut files = vec![];
    for entry in fs::read_dir(saves_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                files.push(name.to_string());
            }
        }
    }
    Ok(files)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            save_game_autosave,
            load_game,
            delete_game,
            save_game_manual,
            list_saves
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
