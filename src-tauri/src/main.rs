// Prevents additional console window on Windows in release, DO NOT REMOVE!!
// #![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// fn main() {
//     whitefeather_lib::run()
// }

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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

#[tauri::command]
fn save_game(app: AppHandle, state: GameState) -> Result<(), String> {
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
fn load_game(app: AppHandle) -> Result<GameState, String> {
    let file_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("saves/autosave.json");

    if !file_path.exists() {
        return Ok(GameState::default());
    }

    let json = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let state: GameState = serde_json::from_str(&json).map_err(|e| e.to_string())?;

    println!("✅ Game loaded: {}", file_path.display());
    Ok(state)
}

#[tauri::command]
fn save_game_named(app: AppHandle, filename: String, state: GameState) -> Result<(), String> {
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
            save_game,
            load_game,
            save_game_named,
            list_saves
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
