// === GEAR STRUCTS ===
use serde::{Deserialize, Serialize};

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
