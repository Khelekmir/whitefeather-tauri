/**
 * Detailed character model (design / combat / details UI).
 * Lightweight roster + saves still use `types/game.ts` until migration.
 */

import type { Position } from './game';
import {
  createEmptyEquipmentLoadout,
  type ArrowHeadStyle,
  type ArrowShaftGrade,
  type EquipmentLoadout,
  type EquipmentLoadoutPatch,
  type FluidSoilBag,
  type MaterialId,
} from './items';

export type { Position };
export type { EquipmentLoadout, EquipmentLoadoutPatch, EquipmentSlotId, ItemSlot } from './items';
export { EQUIPMENT_SLOTS, createEmptyEquipmentLoadout, formatEquipmentSlotLabel } from './items';

/** Arrow shaft currently occupying a wound (one per body part). */
export interface LodgedArrow {
  headStyle: ArrowHeadStyle;
  shaftGrade: ArrowShaftGrade;
  material: MaterialId;
  templateId: string;
  name: string;
}

export type Sex = 'M' | 'F';

// ---------------------------------------------------------------------------
// Body parts — single source of truth for hit locations & itemized health
// ---------------------------------------------------------------------------

/**
 * Canonical combat hit locations. Armor coverage and injury UI must use these ids.
 * Iterate with BODY_PARTS; type keys with BodyPartId.
 */
export const BODY_PARTS = [
  'anus',
  'face',
  'head',
  'neck',
  'groin',
  'earLeft',
  'eyeLeft',
  'hipLeft',
  'earRight',
  'eyeRight',
  'footLeft',
  'handLeft',
  'hipRight',
  'kneeLeft',
  'chestLeft',
  'footRight',
  'handRight',
  'kneeRight',
  'chestRight',
  'buttockLeft',
  'obliqueLeft',
  'buttockRight',
  'lowerArmLeft',
  'lowerLegLeft',
  'obliqueRight',
  'shoulderLeft',
  'stomachLower',
  'stomachUpper',
  'upperArmLeft',
  'lowerArmRight',
  'lowerLegRight',
  'shoulderRight',
  'upperArmRight',
  'thighInnerLeft',
  'thighOuterLeft',
  'thighInnerRight',
  'thighOuterRight',
] as const;

export type BodyPartId = (typeof BODY_PARTS)[number];

// ---------------------------------------------------------------------------
// Weapon types — comprehensive skill list per character
// ---------------------------------------------------------------------------

/**
 * Every character tracks rank in each of these weapon types.
 * Ranks are unbounded numbers that grow through combat use (no soft/hard cap in the type).
 */
export const WEAPON_TYPES = [
  '1hAxe',
  '2hAxe',
  'flail',
  'lance',
  'staff',
  '1hMace',
  '2hMace',
  'dagger',
  'shield',
  '1hSword',
  '2hSword',
  'javelin',
  'longbow',
  'shortbow',
  'ilianLance',
  'recurveBow',
  'unequipped',
  'throwingAxe',
  'throwingKnife',
] as const;

export type WeaponTypeId = (typeof WEAPON_TYPES)[number];

/** Default starting rank for most weapon types (untrained baseline). */
export const DEFAULT_WEAPON_SKILL_RANK = 1;

/** Default rank for unarmed / unequipped (slightly practiced). */
export const DEFAULT_UNEQUIPPED_SKILL_RANK = 10;

// ---------------------------------------------------------------------------
// Stances — cover (defense) + strike (offense), straightforward labels
// ---------------------------------------------------------------------------

/**
 * Defensive postures. Each reshapes which body regions are presented as
 * targets (see data/combat/stances.ts). Thematic names come later.
 */
export const COVER_STANCES = ['coverHigh', 'coverMid', 'coverLow'] as const;
export type CoverStanceId = (typeof COVER_STANCES)[number];

/**
 * Offensive lines. Match / mismatch vs the defender's cover is a 3-way
 * relation (same / adjacent / opposite), not a unique rule per pair.
 */
export const STRIKE_STANCES = ['strikeHigh', 'strikeMid', 'strikeLow'] as const;
export type StrikeStanceId = (typeof STRIKE_STANCES)[number];

export const STANCE_IDS = [...COVER_STANCES, ...STRIKE_STANCES] as const;
export type StanceId = (typeof STANCE_IDS)[number];

/** Untrained baseline — same idea as weapon rank 1. */
export const DEFAULT_STANCE_SKILL_RANK = 1;

export const DEFAULT_COVER_STANCE: CoverStanceId = 'coverMid';
export const DEFAULT_STRIKE_STANCE: StrikeStanceId = 'strikeMid';

/** Per-stance ranks — unbounded, grow with use like weapon skill. */
export type StanceSkill = Record<StanceId, number>;
export type StanceSkillPatch = Partial<StanceSkill>;

/** Live combat pair: how you stand vs how you strike. Chosen separately. */
export interface CombatStance {
  cover: CoverStanceId;
  strike: StrikeStanceId;
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

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
  /**
   * Systemic blood lost in **liters** (same units as synthesized blood volume).
   * Not the same as part.health — wounds vs hemorrhage stay separate.
   * Remaining fraction = (bloodVolume − bloodLoss) / bloodVolume.
   */
  bloodLoss: number;
}

/**
 * Full weapon-skill map — every WeaponTypeId must be present.
 * Values are ranks ≥ 0 that scale up indefinitely with use.
 */
export type WeaponSkill = Record<WeaponTypeId, number>;

/** Sparse overrides when building or training skills. */
export type WeaponSkillPatch = Partial<Record<WeaponTypeId, number>>;

/**
 * Per-body-part injury state.
 * `health` / bleed fields use 0–1 fractions (1 = full / max severity scale).
 */
export interface BodyPartHealth {
  /** Remaining integrity: 0 = ruined, 1 = uninjured */
  health: number;
  /** External bleed severity relative to this part's max bleed rate */
  bleed: number;
  /** Internal bleed severity relative to this area's max bleed rate */
  internalBleed: number;
  /**
   * Contusion severity 0–1 — deposited by internal trauma, persists after
   * internalBleed clots (day-scale fade; vulnerary accelerates).
   * Lowers lewd preferredIntensity on mapped parts.
   */
  bruise: number;
  /**
   * Lodged arrow shaft (if any). Plugs external bleed; movement aggravates
   * internal bleed; extract spikes bleed by head style × material.
   */
  lodgedArrow: LodgedArrow | null;
  sprain: boolean;
  fracture: boolean;
  broken: boolean;
  /**
   * Significant head injury (synced when head.health ≤ concussion threshold).
   * Meaningful on `head`; ignored on other parts.
   */
  concussed: boolean;
  dressed: boolean;
  vulnerary: boolean;
  /**
   * Hand pressure on the wound — emergency bleed control.
   * Weaker than bandage alone; stacks with bandage while held.
   */
  directPressure: boolean;
}

/** Every tracked body area must be present. */
export type ItemizedHealth = Record<BodyPartId, BodyPartHealth>;

/** Sparse updates when applying damage / treatment. */
export type ItemizedHealthPatch = Partial<Record<BodyPartId, Partial<BodyPartHealth>>>;

/**
 * Vital organs — not BodyPartIds. Integrity 1 = intact, 0 = fully compromised.
 * Pierced by thrust when hard chest armor does not deter.
 */
export interface VitalOrgans {
  heart: number;
  lungLeft: number;
  lungRight: number;
}

export type VitalOrganId = keyof VitalOrgans;

/** Which hand is dominant for weapon limb mapping + offhand skill tax. */
export type DominantHand = 'left' | 'right';

export interface CombatStats {
  base: BaseCombatStats;
  weaponSkill: WeaponSkill;
  stanceSkill: StanceSkill;
  /** Out-of-battle default cover. */
  preferredCover: CoverStanceId;
  /** Out-of-battle default strike. */
  preferredStrike: StrikeStanceId;
  /** Live cover + strike (Battleground mutates this per fighter). */
  currentStance: CombatStance;
  itemizedHealth: ItemizedHealth;
  /** Heart / lungs integrity. */
  organs: VitalOrgans;
  /**
   * Downed / unable to act (e.g. heart pierce). Not death — leaves room for
   * magical healing / recovery later.
   */
  incapacitated: boolean;
  /**
   * Dominant weapon hand. Mainhand attacks use this arm chain; offhand slot
   * uses the other (with offhand skill tax until trained).
   */
  dominantHand: DominantHand;
  /**
   * 0–1 progress toward mitigating the offhand skill tax.
   * 0 → full tax (×0.5); 1 → no tax. Raised by future offhand training.
   */
  offhandTraining: number;
}

// ---------------------------------------------------------------------------
// Social (unchanged structure; factories use sensible defaults)
// ---------------------------------------------------------------------------

/** Mood-shift rates from character data (includes legacy CSV wording). */
export type GrowthRate =
  | 'very slow'
  | 'slow'
  | 'pretty slow'
  | 'moderately slow'
  | 'normal'
  | 'moderate'
  | 'moderately fast'
  | 'fast'
  | 'rapid'
  | 'very fast'
  | (string & {});

export interface SocialStatic {
  personality: string;
  temperament: string;
  /**
   * Legacy happiness baselines/rates — happiness is increasingly treated as
   * synthesized wellbeing; prefer durable pressure profiles.
   */
  baselineHappiness: number;
  baselineStress: number;
  happinessGrowth: GrowthRate;
  happinessDecay: GrowthRate;
  stressGrowth: GrowthRate;
  stressDecay: GrowthRate;
  note: string | null;
  alcoholTolerance: Record<string, number>;
  /**
   * Per-character modifiers on temperament pressure baselines/rates.
   * Pain load is derived from itemized health and is not modified here.
   */
  pressureMods?: import('../data/social/durablePressures').CharacterPressureModifiers;
}

export interface SocialDynamic {
  mood: string;
  /** Legacy / display wellbeing — prefer synthesizing from durable pressures. */
  happiness: number;
  stress: number;
  /** Social/fatigue energy (0–100). Distinct from combat stamina, though combat can write into it. */
  energy: number;
  belonging: number;
  agency: number;
  pride: number;
  shame: number;
  /**
   * Dynamic idle targets for personalized pressures (incl. lust).
   * Anchors come from temperament × pressureMods and do not change;
   * these wander within ±baselineWanderMax of the anchor as lived experience accumulates.
   */
  pressureBaselines?: Partial<
    Record<import('../data/social/durablePressures').PersonalizedPressureId, number>
  >;
  /** Blood alcohol percent (0.08 = 0.08%). Rises as gut ethanol absorbs. */
  BAC: number;
  peakBAC: number;
  /**
   * Ethanol (grams) swallowed but not yet in the blood — stomach/gut pool.
   * Consuming drinks adds here; time ticks move it into BAC.
   */
  unabsorbedEthanolG: number;
  hoursSinceLastDrink: number | null;
  intoxicationStage: string;
  alcoholFatigue: number;
  hangoverSeverity: number;
}

export interface SocialStats {
  static: SocialStatic;
  dynamic: SocialDynamic;
}

// ---------------------------------------------------------------------------
// Lewd (still open-keyed for regions; can align to BodyPartId later)
// ---------------------------------------------------------------------------

export interface LewdExperience {
  first: string;
  partners: Record<string, number>;
  encounters: number;
}

export interface LewdStatic {
  allure: number;
  libido: number;
  charisma: number;
  experience: {
    anal: LewdExperience;
    vaginal: LewdExperience;
    oralPitchMale: LewdExperience;
    oralPitchFemale: LewdExperience;
    oralReceiveMale: LewdExperience;
    oralReceiveFemale: LewdExperience;
  };
  submissive: boolean;
  /**
   * How much nociception they can take before physical discomfort spikes (0–10).
   * 5 = average; higher = sting lands softer on the body meter.
   */
  painTolerance: number;
  /**
   * How readily good-bond pain reads as wanted rather than scary (0–10).
   * High appetite + warm bond → little/no psych discomfort from spank/bite.
   */
  painAppetite: number;
  /**
   * Ilian Whitewing culture — sapphic bonding is normative (mentor/mentee etc.).
   * Counts as native attraction toward women for Desire gating.
   */
  whitewing: boolean;
  /**
   * Non-Ilian (or loosely any) woman inducted into sapphic practice by a Whitewing,
   * or colloquially any woman engaging in sapphic behavior. Counts as attraction
   * toward women once set.
   */
  whitefeather: boolean;
  attractedToBoys: boolean;
  attractedToGirls: boolean;
  /** Cycle length in **days** (typically 24–32). */
  ovulationCycleLength: number;
  /**
   * How strongly arousal/lust climb preferred intensity (default 1).
   * >1 = heat hungrier for intensity; <1 = stays near baseline longer.
   */
  intensityArousalGain?: number;
}

/** Where a sperm cohort enters / where conception is attributed. */
export type SpermEntrySite =
  | 'vaginaDeep'
  | 'vaginaShallow'
  | 'labia'
  | 'perineum'
  | 'anus';

export type OvumStation = 'tubeProximal' | 'tubeDistal' | 'uterine';

/** Live ovum in transit (S4). */
export interface OvumState {
  id: string;
  ageHours: number;
  station: OvumStation;
  viabilityHoursLeft: number;
}

/** Motile semen cohort ascending the tract (S4). */
export interface SpermCohort {
  id: string;
  fromId: string;
  entrySite: SpermEntrySite;
  volume: number;
  motilityHoursLeft: number;
  /** 0 = entry site, 1 = tube meeting zone. */
  ascent01: number;
}

export type PregnancyStatus =
  | 'ongoing'
  | 'miscarried'
  | 'terminated'
  | 'birthed';

export type ImplantationKind = 'intrauterine' | 'ectopic';

export interface ConceptusState {
  id: string;
  stage: 'zygote' | 'embryo' | 'fetus';
  /** Stub for future child health (0–100). */
  health: number;
}

export interface PregnancyState {
  /** Cycle-hour stamp at conception (diagnostic). */
  conceivedAtCycleHour: number;
  gestationDay: number;
  fatherId?: string;
  conceptionSite: SpermEntrySite;
  fertStation: OvumStation;
  implantation: ImplantationKind;
  conceptus: ConceptusState;
  status: PregnancyStatus;
}

export interface LewdDynamic {
  /**
   * Encounter meters (Arousal / Edge / Discomfort) are ephemeral lab/combat-sex
   * state — not persisted here. Lust remains the standing lewd drive meter.
   */
  lust: number;
  timeSinceLast: Record<string, number>;
  /**
   * Hours since menses / cycle start (0 … ovulationCycleLength*24).
   * Not a day index — see `utils/lewd/ovulationCycle.ts`.
   */
  ovulationCycleCurrent: number;
  /**
   * Skin / nude crotch soil (wet→dry). Cloth soil lives on item.lewdStats.soiled.
   * See `utils/lewd/fluidSoil.ts`.
   */
  crotchSoil?: Partial<FluidSoilBag>;
  /** Live egg in tract, if any. */
  ovum?: OvumState | null;
  /** Active motile sperm cohorts. */
  spermCohorts?: SpermCohort[];
  /** Ongoing / resolved pregnancy stub. */
  pregnancy?: PregnancyState | null;
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

// ---------------------------------------------------------------------------
// Unit
// ---------------------------------------------------------------------------

export interface Pictures {
  fullbodyDamaged?: string | null;
  fullbodyStanding?: string | null;
  fullbodyAttacking?: string | null;
  fullbodyAttackingSpecial?: string | null;
  unitMini?: string | null;
}

/** Detailed character — combat, social, lewd, equipment references. */
export interface Unit {
  id: string;
  name: string;
  sex: Sex;
  age: number;
  height: number; // inches
  weight: number; // lbs
  description: string;

  combatStats: CombatStats;
  socialStats: SocialStats;
  lewdStats: LewdStats;

  tradeSkills: Record<string, unknown>;
  misc: Record<string, unknown>;

  pictures: Pictures;

  /**
   * Full equipment loadout — every EQUIPMENT_SLOTS entry is present.
   * Value is Item.id, or null if the slot is empty.
   */
  equipment: EquipmentLoadout;

  allegiance: 'player' | 'enemy' | 'ally';
  class?: string;
  level?: number;
  position?: Position;
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function createDefaultBodyPartHealth(
  overrides?: Partial<BodyPartHealth>
): BodyPartHealth {
  return {
    health: 1,
    bleed: 0,
    internalBleed: 0,
    bruise: 0,
    lodgedArrow: null,
    sprain: false,
    fracture: false,
    broken: false,
    concussed: false,
    dressed: false,
    vulnerary: false,
    directPressure: false,
    ...overrides,
  };
}

/**
 * Full itemized health map for all BODY_PARTS.
 * Pass sparse per-part overrides for injuries without listing every key.
 */
export function createDefaultItemizedHealth(
  overrides?: ItemizedHealthPatch
): ItemizedHealth {
  const result = {} as ItemizedHealth;
  for (const part of BODY_PARTS) {
    result[part] = createDefaultBodyPartHealth(overrides?.[part]);
  }
  return result;
}

/**
 * Full weapon-skill map for all WEAPON_TYPES.
 * Defaults: rank 1 for each type, unequipped at 10; pass sparse overrides for specialties.
 */
export function createDefaultWeaponSkill(
  overrides?: WeaponSkillPatch
): WeaponSkill {
  const result = {} as WeaponSkill;
  for (const weaponType of WEAPON_TYPES) {
    if (overrides?.[weaponType] !== undefined) {
      result[weaponType] = overrides[weaponType]!;
    } else if (weaponType === 'unequipped') {
      result[weaponType] = DEFAULT_UNEQUIPPED_SKILL_RANK;
    } else {
      result[weaponType] = DEFAULT_WEAPON_SKILL_RANK;
    }
  }
  return result;
}

/** Full stance-skill map. Defaults rank 1; pass sparse overrides for specialties. */
export function createDefaultStanceSkill(
  overrides?: StanceSkillPatch
): StanceSkill {
  const result = {} as StanceSkill;
  for (const id of STANCE_IDS) {
    result[id] = overrides?.[id] ?? DEFAULT_STANCE_SKILL_RANK;
  }
  return result;
}

export function createDefaultCombatStance(options?: {
  preferredCover?: CoverStanceId;
  preferredStrike?: StrikeStanceId;
  currentStance?: Partial<CombatStance>;
}): CombatStance {
  return {
    cover:
      options?.currentStance?.cover ??
      options?.preferredCover ??
      DEFAULT_COVER_STANCE,
    strike:
      options?.currentStance?.strike ??
      options?.preferredStrike ??
      DEFAULT_STRIKE_STANCE,
  };
}

export function createDefaultBaseCombatStats(
  overrides?: Partial<BaseCombatStats>
): BaseCombatStats {
  const health = overrides?.health ?? 28;
  const staminaCap = overrides?.staminaCap ?? 20;
  return {
    luck: 5,
    magic: 3,
    skill: 8,
    speed: 10,
    health,
    reflex: 8,
    agility: 9,
    defense: 6,
    movement: 5,
    strength: 8,
    resistance: 4,
    staminaCap,
    constitution: 7,
    healthCurrent: overrides?.healthCurrent ?? health,
    staminaCurrent: overrides?.staminaCurrent ?? staminaCap,
    bloodLoss: 0,
    ...overrides,
  };
}

export function createDefaultVitalOrgans(
  overrides?: Partial<VitalOrgans>
): VitalOrgans {
  return {
    heart: 1,
    lungLeft: 1,
    lungRight: 1,
    ...overrides,
  };
}

export function createDefaultCombatStats(options?: {
  base?: Partial<BaseCombatStats>;
  weaponSkill?: WeaponSkillPatch;
  stanceSkill?: StanceSkillPatch;
  preferredCover?: CoverStanceId;
  preferredStrike?: StrikeStanceId;
  currentStance?: Partial<CombatStance>;
  itemizedHealth?: ItemizedHealthPatch;
  organs?: Partial<VitalOrgans>;
  incapacitated?: boolean;
  dominantHand?: DominantHand;
  offhandTraining?: number;
}): CombatStats {
  const preferredCover = options?.preferredCover ?? DEFAULT_COVER_STANCE;
  const preferredStrike = options?.preferredStrike ?? DEFAULT_STRIKE_STANCE;
  return {
    base: createDefaultBaseCombatStats(options?.base),
    weaponSkill: createDefaultWeaponSkill(options?.weaponSkill),
    stanceSkill: createDefaultStanceSkill(options?.stanceSkill),
    preferredCover,
    preferredStrike,
    currentStance: createDefaultCombatStance({
      preferredCover,
      preferredStrike,
      currentStance: options?.currentStance,
    }),
    itemizedHealth: createDefaultItemizedHealth(options?.itemizedHealth),
    organs: createDefaultVitalOrgans(options?.organs),
    incapacitated: options?.incapacitated ?? false,
    dominantHand: options?.dominantHand ?? 'right',
    offhandTraining: Math.max(
      0,
      Math.min(1, options?.offhandTraining ?? 0)
    ),
  };
}

function createDefaultLewdExperience(
  overrides?: Partial<LewdExperience>
): LewdExperience {
  return {
    first: 'virgin',
    partners: {},
    encounters: 0,
    ...overrides,
  };
}

export function createDefaultSocialStats(options?: {
  static?: Partial<SocialStatic>;
  dynamic?: Partial<SocialDynamic>;
}): SocialStats {
  const baselineHappiness = options?.static?.baselineHappiness ?? 0.7;
  const baselineStress = options?.static?.baselineStress ?? 0.3;
  return {
    static: {
      personality: 'neutral',
      temperament: 'neutral',
      baselineHappiness,
      baselineStress,
      happinessGrowth: 'normal',
      happinessDecay: 'normal',
      stressGrowth: 'normal',
      stressDecay: 'normal',
      note: null,
      alcoholTolerance: {},
      ...options?.static,
    },
    dynamic: {
      mood: 'calm',
      happiness: baselineHappiness,
      stress: baselineStress,
      energy: 70,
      belonging: 60,
      agency: 60,
      pride: 50,
      shame: 20,
      BAC: 0,
      peakBAC: 0,
      unabsorbedEthanolG: 0,
      hoursSinceLastDrink: null,
      intoxicationStage: 'sober',
      alcoholFatigue: 0,
      hangoverSeverity: 0,
      ...options?.dynamic,
    },
  };
}

export function createDefaultLewdStats(options?: {
  static?: Partial<LewdStatic>;
  dynamic?: Partial<LewdDynamic>;
  itemizedLewd?: ItemizedLewd;
}): LewdStats {
  return {
    static: {
      allure: 5,
      libido: 5,
      charisma: 5,
      experience: {
        anal: createDefaultLewdExperience(),
        vaginal: createDefaultLewdExperience(),
        oralPitchMale: createDefaultLewdExperience(),
        oralPitchFemale: createDefaultLewdExperience(),
        oralReceiveMale: createDefaultLewdExperience(),
        oralReceiveFemale: createDefaultLewdExperience(),
      },
      submissive: false,
      painTolerance: 5,
      painAppetite: 3,
      whitewing: false,
      whitefeather: false,
      attractedToBoys: true,
      attractedToGirls: true,
      ovulationCycleLength: 28,
      ...options?.static,
    },
    dynamic: {
      lust: 0,
      timeSinceLast: {},
      /** Default ~day 10 follicular (hours). */
      ovulationCycleCurrent: 10 * 24,
      ...options?.dynamic,
    },
    itemizedLewd: options?.itemizedLewd ?? {},
  };
}

export type CreateDetailedUnitInput = Omit<
  Unit,
  'combatStats' | 'socialStats' | 'lewdStats' | 'tradeSkills' | 'misc' | 'pictures' | 'equipment'
> & {
  combatStats?: {
    base?: Partial<BaseCombatStats>;
    weaponSkill?: WeaponSkillPatch;
    stanceSkill?: StanceSkillPatch;
    preferredCover?: CoverStanceId;
    preferredStrike?: StrikeStanceId;
    currentStance?: Partial<CombatStance>;
    itemizedHealth?: ItemizedHealthPatch;
    organs?: Partial<VitalOrgans>;
    incapacitated?: boolean;
    dominantHand?: DominantHand;
    offhandTraining?: number;
  };
  socialStats?: {
    static?: Partial<SocialStatic>;
    dynamic?: Partial<SocialDynamic>;
  };
  lewdStats?: {
    static?: Partial<LewdStatic>;
    dynamic?: Partial<LewdDynamic>;
    itemizedLewd?: ItemizedLewd;
  };
  tradeSkills?: Record<string, unknown>;
  misc?: Record<string, unknown>;
  pictures?: Pictures;
  /** Sparse equip map; unspecified slots default to null (empty). */
  equipment?: EquipmentLoadoutPatch;
};

/** Build a full detailed unit without hand-writing every nested default. */
export function createDetailedUnit(input: CreateDetailedUnitInput): Unit {
  return {
    id: input.id,
    name: input.name,
    sex: input.sex,
    age: input.age,
    height: input.height,
    weight: input.weight,
    description: input.description,
    allegiance: input.allegiance,
    class: input.class,
    level: input.level,
    position: input.position,
    combatStats: createDefaultCombatStats(input.combatStats),
    socialStats: createDefaultSocialStats(input.socialStats),
    lewdStats: createDefaultLewdStats(input.lewdStats),
    tradeSkills: input.tradeSkills ?? {},
    misc: input.misc ?? {},
    pictures: input.pictures ?? {},
    equipment: createEmptyEquipmentLoadout(input.equipment),
  };
}

/** Human-readable label for body part ids (UI). */
export function formatBodyPartLabel(id: BodyPartId): string {
  return id
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/** Human-readable label for stance ids (UI). */
export function formatStanceLabel(id: StanceId): string {
  const labels: Record<StanceId, string> = {
    coverHigh: 'Cover High',
    coverMid: 'Cover Mid',
    coverLow: 'Cover Low',
    strikeHigh: 'Strike High',
    strikeMid: 'Strike Mid',
    strikeLow: 'Strike Low',
  };
  return labels[id];
}

/** Human-readable label for weapon type ids (UI). */
export function formatWeaponTypeLabel(id: WeaponTypeId): string {
  const special: Partial<Record<WeaponTypeId, string>> = {
    '1hAxe': '1H Axe',
    '2hAxe': '2H Axe',
    '1hMace': '1H Mace',
    '2hMace': '2H Mace',
    '1hSword': '1H Sword',
    '2hSword': '2H Sword',
    ilianLance: 'Ilian Lance',
    recurveBow: 'Recurve Bow',
    throwingAxe: 'Throwing Axe',
    throwingKnife: 'Throwing Knife',
  };
  if (special[id]) return special[id]!;
  return id.replace(/^./, (c) => c.toUpperCase());
}
