export interface Position { /* existing */ }

export type Sex = 'M' | 'F' | 'Other';

export interface BaseCombatStats {
  luck: number;
  magic: number;
  skill: number;
  speed: number;
  health: number;
  reflex: number;
  agility: number;
  defense: number;
  movement: number;
  strength: number;
  resistance: number;
  staminaCap: number;
  constitution: number;
  healthCurrent: number;
  staminaCurrent: number;
}

export interface WeaponSkill {
  [weaponType: string]: number; // e.g. "1hSword": 150, "dagger": 10
}

export interface BodyPartHealth {
  bleed: number;
  health: number;
  dressed: boolean;
  vulnerary: boolean;
  bleedMinutes: number;
}

export interface ItemizedHealth {
  [bodyPart: string]: BodyPartHealth;
}

export interface CombatStats {
  base: BaseCombatStats;
  weaponSkill: WeaponSkill;
  itemizedHealth: ItemizedHealth;
}

export interface SocialStatic {
  personality: string;
  temperament: string;
  baselineHappiness: number;
  baselineStress: number;
  happinessGrowth: string;
  happinessDecay: string;
  stressGrowth: string;
  stressDecay: string;
  note: string;
  alcoholTolerance: Record<string, number>;
}

export interface SocialDynamic {
  mood: string;
  happiness: number;
  stress: number;
  BAC: number;
  peakBAC: number;
  hoursSinceLastDrink: number;
  intoxicationStage: string;
  alcoholFatigue: number;
  hangoverSeverity: number;
}

export interface SocialStats {
  static: SocialStatic;
  dynamic: SocialDynamic;
}

export interface LewdExperience {
  first: string;
  partners: Record<string, number>;
  encounters: number;
}

export interface LewdAction {
  talent: number;
  experience: number;
}

export interface LewdStatic {
  allure: number;
  libido: number;
  charisma: number;
  dominance: number;
  experience: {
    anal: LewdExperience;
    vaginal: LewdExperience;
    lewdActions: Record<string, LewdAction>;
    oralPitchMale: LewdExperience;
    // ... other categories
  };
  submissive: boolean;
  whitefeather: boolean;
  attractedToBoys: boolean;
  attractedToGirls: boolean;
  ovulationCycleLength: number;
}

export interface LewdDynamic {
  PNS: number;
  SNS: number;
  lust: number;
  timeSinceLast: Record<string, number>;
  ovulationCycleCurrent: number;
}

export interface BodyPartLewd {
  preference: number;
  sensitivity: number;
  prefIntensity?: number;
  maxIntensity: number;
}

export interface ItemizedLewd {
  [bodyPart: string]: BodyPartLewd;
}

export interface LewdStats {
  static: LewdStatic;
  dynamic: LewdDynamic;
  itemizedLewd: ItemizedLewd;
}

export interface Pictures {
  fullbodyDamaged?: string;
  fullbodyStanding?: string;
  fullbodyAttacking?: string;
  fullbodyAttackingSpecial?: string;
  unitMini?: string;
  // Add more as needed
}

export interface Unit {  // ← Renamed from previous simple version
  id: string;
  name: string;
  sex: Sex;
  age: number;
  height: number;      // inches
  weight: number;      // lbs
  description: string;

  combatStats: CombatStats;
  socialStats: SocialStats;
  lewdStats: LewdStats;

  tradeSkills: Record<string, any>;   // placeholder for now
  misc: Record<string, any>;

  pictures: Pictures;

  // Equipment (references to Item.id)
  equipment: Partial<Record<string, string | null>>; // key = slot like "mainhand", "head"

  allegiance: 'player' | 'enemy' | 'ally';
  class?: string;
  level?: number;
  position?: Position;
  // Add relationship/arousal/stress here if you want them at top level too
}

export interface GameState {
  chapter: number;
  turn: number;
  phase: string;
  mapId: string;
  units: Unit[];           // ← Now holds rich character data
//   items: Item[];           // from previous recommendation
  gold: number;
  inventory: string[];     // item IDs
  storyFlags: Record<string, boolean>;
  lastAutosave: string;
}