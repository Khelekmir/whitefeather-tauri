// === CHARACTER STRUCTS ===
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::models::{position::Position};


#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct BaseCombatStats {
    pub luck: u32,
    pub magic: u32,
    pub skill: u32,
    pub speed: u32,
    pub health: u32,
    pub reflex: u32,
    pub agility: u32,
    pub defense: u32,
    pub movement: u32,
    pub strength: u32,
    pub resistance: u32,
    pub stamina_cap: u32,
    pub constitution: u32,
    pub health_current: u32,
    pub stamina_current: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct WeaponSkill {
    #[serde(flatten)]
    pub skills: std::collections::HashMap<String, u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct BodyPartHealth {
    pub bleed: u32,
    pub health: u32,
    pub dressed: bool,
    pub vulnerary: bool,
    pub bleed_minutes: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ItemizedHealth {
    #[serde(flatten)]
    pub parts: std::collections::HashMap<String, BodyPartHealth>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct CombatStats {
    pub base: BaseCombatStats,
    pub weapon_skill: WeaponSkill,
    pub itemized_health: ItemizedHealth,
}

// Social Stats
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SocialStatic {
    pub personality: String,
    pub temperament: String,
    pub baseline_happiness: u32,
    pub baseline_stress: u32,
    pub happiness_growth: String,
    pub happiness_decay: String,
    pub stress_growth: String,
    pub stress_decay: String,
    pub note: String,
    pub alcohol_tolerance: std::collections::HashMap<String, f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SocialDynamic {
    pub mood: String,
    pub happiness: u32,
    pub stress: u32,
    pub bac: f64,
    pub peak_bac: f64,
    pub hours_since_last_drink: u32,
    pub intoxication_stage: String,
    pub alcohol_fatigue: u32,
    pub hangover_severity: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SocialStats {
    pub static_data: SocialStatic,   // renamed to avoid keyword conflict
    pub dynamic: SocialDynamic,
}

// Lewd Stats (similar nesting)
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct LewdExperience {
    pub first: String,
    pub partners: std::collections::HashMap<String, u32>,
    pub encounters: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct LewdAction {
    pub talent: u32,
    pub experience: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct LewdStatic {
    pub allure: u32,
    pub libido: u32,
    pub charisma: u32,
    pub dominance: u32,
    pub experience: HashMap<String, serde_json::Value>, // flexible
    pub submissive: bool,
    pub whitefeather: bool,
    pub attracted_to_boys: bool,
    pub attracted_to_girls: bool,
    pub ovulation_cycle_length: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct BodyPartLewd {
    pub preference: u32,
    pub sensitivity: u32,
    pub max_intensity: u32,
    pub pref_intensity: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ItemizedLewd {
    #[serde(flatten)]
    pub parts: HashMap<String, BodyPartLewd>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct LewdStats {
    pub static_data: LewdStatic,
    pub dynamic: HashMap<String, serde_json::Value>, // flexible for now
    pub itemized_lewd: ItemizedLewd,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Pictures {
    pub fullbody_damaged: Option<String>,
    pub fullbody_standing: Option<String>,
    pub fullbody_attacking: Option<String>,
    pub fullbody_attacking_special: Option<String>,
    pub unit_mini: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Unit {
    pub id: String,
    pub name: String,
    pub sex: String,
    pub age: u32,
    pub height: u32,
    pub weight: u32,
    pub description: String,

    pub combat_stats: CombatStats,
    pub social_stats: SocialStats,
    pub lewd_stats: LewdStats,

    pub trade_skills: std::collections::HashMap<String, serde_json::Value>,
    pub misc: std::collections::HashMap<String, serde_json::Value>,

    pub pictures: Pictures,

    // Equipment references
    pub equipment: std::collections::HashMap<String, Option<String>>, // "mainhand" -> item_id

    pub allegiance: String,
    pub class: Option<String>,
    pub level: Option<u32>,
    pub position: Option<Position>,
}