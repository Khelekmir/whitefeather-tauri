import type { ItemSlot, MaterialId } from '../../types/items';

/**
 * Battlefield gear-pressure tuning.
 *
 * Design (policy B):
 * - Unarmored / soft-kit characters take harsh *wounds* when hit (dodge is their real defense later).
 * - Soft outfits also *wreck* under melee — erotic / presentation stakes on the field.
 * - Steel↔steel still costs gear, but is paced for fight length (enjoyment).
 * - Later: male→female accuracy drop, grapple vs lethal, rescue → social bonds.
 */

/** Soft materials — clothes, underlayers, most “outfit” pieces. */
export const SOFT_MATERIALS: ReadonlySet<MaterialId> = new Set([
  'cloth',
  'leather',
  'body',
  'unequipped',
]);

/** Hard materials — clash wear, real armor. */
export const HARD_MATERIALS: ReadonlySet<MaterialId> = new Set([
  'iron',
  'lowGradeSteel',
  'highGradeSteel',
  'springSteel',
  'mithril',
  'adamantite',
  'wood', // shields / staves: treated as hard for clash purposes
]);

/** Slots that read as “outfit” when soft — wrecking these is the erotic battlefield beat. */
export const OUTFIT_SLOTS: ReadonlySet<ItemSlot> = new Set([
  'shirt',
  'undershirt',
  'underwear',
  'leg',
  'waist',
  'back',
  'head',
  'hand',
  'foot',
]);

export function isSoftMaterial(material: MaterialId): boolean {
  return SOFT_MATERIALS.has(material);
}

export function isHardMaterial(material: MaterialId): boolean {
  return HARD_MATERIALS.has(material);
}

export function isOutfitSlot(slot: ItemSlot): boolean {
  return OUTFIT_SLOTS.has(slot);
}

export const COMBAT_TUNING = {
  /** Global flesh / mitigation (leave alone to keep STR disparity). */
  physicalConstant: 1,
  armorEffectiveness: 1,

  /**
   * Soft outfit wreck (cloth dress, chemise, etc.).
   * High on purpose: a few solid melee hits should ruin the look.
   */
  softArmorWearScale: 0.085,
  /** Extra multiplier when the outermost hit layer is soft outfit (no plate in the way). */
  softOutermostOutfitBonus: 1.75,
  /** Minimum chip so even glancing hits fray cloth. */
  softArmorMinChip: 0.04,

  /**
   * Hard armor wear (plate, steel).
   * Uses √attackValue so Kent still pressures steel without deleting a breastplate in 3 hits.
   */
  hardArmorWearScale: 0.012,
  /** Extra when weapon hardness ≈ armor hardness (metal clash). */
  metalClashBonus: 1.45,
  /** How close hardness ratio must be to count as “clash”. */
  metalClashRatioMin: 0.55,
  metalClashRatioMax: 1.8,

  /**
   * Weapon wear.
   * High vs hard armor (blade vs plate); low vs soft / flesh (cut goes into the body).
   */
  weaponWearVsHardScale: 0.018,
  weaponWearVsSoftScale: 0.004,
  weaponWearVsFleshScale: 0.002,

  /**
   * Attack-value vs weapon durability (soft until break).
   * Linear intact curve through (referenceRatio, referenceMult) and (1, 1).
   * At/below brokenRatio the swing collapses to unequipped/punch.
   */
  weaponDurabilityAttack: {
    /** durability/max ≤ this → treat as broken (punch fallback). */
    brokenRatio: 0.02,
    /** Anchor: at this wear ratio, attack mult = referenceMult (e.g. 5% → 80%). */
    referenceRatio: 0.05,
    referenceMult: 0.8,
  },

  /** Layer falloff: outer takes full wear, next 1/2, then 1/4… */
  layerFalloffBase: 2,

  /**
   * Bleed over time (Pass time on Battleground).
   * part.health = wound; part.bleed = bleed intensity;
   * bloodLoss = liters lost from synthesized blood volume.
   */
  /**
   * Liters lost per (bleedRate × minute).
   * Rough feel: sustained rate ~4 over 10 min ≈ 0.8–1.0 L on a ~5 L adult
   * (moderate hemorrhage class) before clotting/care.
   */
  bleedToBloodLossScale: 0.022, // 0.022
  /**
   * Direct stamina point drain per (bleedRate × minute), on top of
   * blood-fraction stamina *effectiveness* penalties.
   */
  bleedToStaminaScale: 0.35,
  /** Clotting: bleed intensity drop per minute when allowed to clot. */
  clotRatePerMinute: 0.08,
  /** Ruined undressed parts (health 0, !dressed) do not clot below this intensity. */
  unclottableRuinedIntensity: 1,
  /**
   * Internal bleed vs external.
   * - Rate mult: internal still drains volume but less “spray”
   * - Clot mult: slower natural internal clotting
   * - Vulnerary efficiency: salve helps internal at this fraction of full effect
   *   (rate cut + clot boost); dressing never affects internal.
   */
  internalBleedRateMult: 0.85,
  internalClotMult: 0.65,
  vulneraryInternalEfficiency: 0.75,

  /**
   * Bruising — blunt/internal residue. Slow fade for post-combat care beats.
   */
  bruise: {
    /** damagePercent × internalFrac × this → bruise gain. */
    fromInternalMult: 1,
    /** Soft floor: bruise ≥ internalBleed × this. */
    linkToInternal: 0.5,
    /** Unassisted fade per minute (~8h+ from full toward faint). */
    fadePerMinute: 0.002,
    /** While vulnerary on part — nighttime salve clears much faster. */
    vulneraryFadeMult: 4,
    /** Active internalBleed slows bruise resolution. */
    fadeSlowFromInternal: 0.5,
    /** Below this, treat as cleared. */
    minVisible: 0.05,
  },

  /**
   * Sprain / fracture / broken — independent of part.health.
   * Highest flag per part only (broken > fracture > sprain).
   */
  traumaFlags: {
    severity: { sprain: 1, fracture: 2, broken: 3 },
    lowerBody: {
      mobilityPerPoint: 0.06,
      dodgePerPoint: 0.07,
      floor: 0.25,
    },
    arms: {
      attackPerPoint: 0.05,
      parryPerPoint: 0.06,
      blockPerPoint: 0.06,
      floor: 0.3,
    },
    chestBroken: {
      staminaDrainMult: 1.35,
      globalCombatMult: 0.88,
    },
  },

  /**
   * Natural healing + care (bandage / vulnerary) — see woundCare.ts.
   * Heal advances part.health on tickBleed; clot mult scales clotRatePerMinute.
   */
  woundCare: {
    /**
     * Unassisted health recovery per minute (0–1 scale).
     * Deliberately glacial — not viable for short-term recovery
     * (~50% wound ≈ 3+ weeks). Magic/holy healing will cover acute care.
     */
    naturalHealPerMinute: 0.000015,
    /** Bandage (`dressed`): mild heal accel; clotting is its main job. */
    bandageHealMult: 1.15,
    /**
     * Vulnerary (`vulnerary`): major convalescence boost.
     * Effective ≈ 0.000225/min → light chip (~0.2) overnight (~15 h);
     * full recovery from ruined ≈ 3 days with salve.
     */
    vulneraryHealMult: 15,
    /** Bandage primary job — clotting. */
    bandageClotMult: 3,
    /** Vulnerary also clots. */
    vulneraryClotMult: 2,
    /** From health 0 once dressed — slow stump recovery. */
    ruinedDressedHealMult: 0.35,
    fractureHealMult: 0.5,
    brokenHealMult: 0.25,
  },

  /**
   * Active bleed → cloth soil (Pass Time / tickBleed).
   * amount01 = bleedRate × minutes × bleedSoilPerRateMinute × coverage × absorb,
   * applied innermost-covering layer first; flow × bleedSoilBleedThrough continues outward.
   */
  bleedSoilPerRateMinute: 0.045,
  /** Fraction of remaining blood flow that continues past a layer after it soaks. */
  bleedSoilBleedThrough: 0.42,
  /** Soft cloth / leather absorb multiplier (vs hard plate surface stain). */
  bleedSoilSoftAbsorb: 1,
  bleedSoilHardAbsorb: 0.32,

  /**
   * Attacker rhythm QTE (Legend of Dragoon–style shrinking square).
   * Used when Battleground “Use attack rhythm” is on; bypass keeps 100% hit.
   */
  rhythm: {
    /** Base time for the outer square to finish its shrink (ms). */
    durationMs: 1100,
    /** Outer square starts at this scale (inner = 1). */
    startScale: 2.75,
    /** Outer continues shrinking past the inner so late presses are possible. */
    endScale: 0.55,
    /** |scale − 1| ≤ this → crit (before competence / luck scaling). */
    critBand: 0.02,
    /** |scale − 1| ≤ this → hit (before competence scaling). */
    hitBand: 0.1,
    /** Rotation degrees over the full duration. */
    rotationDegrees: 270,
    /** Crit multiplies attack value before damage. */
    critAttackMultiplier: 1.4,
    /**
     * How strongly stance windowFactor tightens bands / speeds the QTE.
     * effectiveBand = baseBand * lerp(1, windowFactor, this).
     */
    windowBandInfluence: 0.85,
    /** Miss still costs this fraction of a normal swing stamina. */
    missStaminaFraction: 0.55,

    /**
     * Attacker competence (weapon + strike transfer) → band width & collapse.
     * See rhythmCompetence.ts / weaponFamilies.ts.
     */
    competence: {
      /** Blend weights for final competence (should sum ~1 with baseSkillWeight). */
      weaponWeight: 0.58,
      strikeWeight: 0.37,
      baseSkillWeight: 0.05,
      /** Family avg × this can floor weaponEff when specific is low. */
      weaponFamilyFloor: 0.4,
      /** Top-N general melee avg × this as a weaker floor. */
      weaponGeneralFloor: 0.2,
      /** How many highest weapon ranks feed “general melee.” */
      generalTopN: 3,
      /** Strike-line family floor (mid gets a slightly better bridge). */
      strikeFamilyFloor: 0.45,
      strikeFamilyFloorMid: 0.55,
      /**
       * Band scale from competence: band *= (bandFloor + (1 - bandFloor) * competence).
       * Low competence → much tighter hit/crit windows.
       */
      bandFloor: 0.22,
      /**
       * Untrained haste: duration /= 1 + (1 - competence) * untrainedHaste.
       * Faster collapse = harder (clumsy swing).
       */
      untrainedHaste: 0.55,
      /**
       * High SPD eases collapse: duration *= 1 + speedFactor * speedEase.
       * Slower collapse = easier.
       */
      speedEase: 0.22,
      /**
       * High LCK widens crit band only: crit *= 1 + luckFactor * luckCritBonus.
       */
      luckCritBonus: 0.35,
    },
  },

  /**
   * Player defender QTE (Dodge / Parry) — reuses shrinking-square visuals.
   * Battleground: Fighter A = player; B→A uses this instead of NPC %.
   */
  defenseRhythm: {
    /** Base collapse time (ms); further scaled by verb + stance. */
    durationMs: 1000,
    startScale: 2.6,
    endScale: 0.55,
    critBand: 0.028,
    hitBand: 0.12,
    rotationDegrees: 240,
    /**
     * Dodge is easier than parry by default (wider bands, slightly slower).
     * Final dodge band *= dodgeBandEase; duration *= dodgeDurationEase.
     */
    dodgeBandEase: 1.25,
    dodgeDurationEase: 1.12,
    /**
     * How strongly parryWindowFactor tightens parry bands / speeds collapse.
     * (Same idea as rhythm.windowBandInfluence.)
     */
    parryWindowInfluence: 0.9,
    /**
     * Dodge: mobility/blood factor (0–1) scales bands.
     * band *= dodgeMobilityFloor + (1 - floor) * mobilityEffective
     */
    dodgeMobilityFloor: 0.35,
    /**
     * AvoidanceDelta > 0 eases dodge (slower collapse / wider band).
     * duration *= 1 + max(0, avoidanceDelta) * avoidanceEase
     * band *= 1 + max(0, avoidanceDelta) * avoidanceBand
     */
    avoidanceEase: 0.45,
    avoidanceBand: 0.35,
    /** Negative avoidance (opposite line) haste / tighten. */
    avoidanceHaste: 0.35,
    avoidanceTighten: 0.25,
  },

  /**
   * Stance matchup (cover vs strike). Window factor now also sizes the
   * attacker rhythm bands when rhythm mode is on. Body-part remap is live.
   */
  stance: {
    /** Max window shrink when same-line net guard is 1. */
    sameWindowPenalty: 0.45,
    adjacentWindowPenalty: 0.18,
    oppositeWindowBonus: 0.28,
    /** Preview-only avoidance deltas (not rolled while 100% hit). */
    sameAvoidanceAdd: 0.2,
    adjacentAvoidanceAdd: 0.07,
    oppositeAvoidanceAdd: -0.12,
    /** Adjacent uses a fraction of (guard − break). */
    adjacentNetScale: 0.4,
    onLineAffinity: 1,
    adjacentLineAffinity: 0.65,
    oppositeLineAffinity: 0.4,
    rangedSamePenaltyScale: 0.45,
    rangedOppositeBonusScale: 1.15,
    /**
     * Defender parry QTE band width by attacker's strike line.
     * Low swings are slightly harder to catch cleanly (legs/groin angle).
     */
    parryWindowByStrikeLine: {
      high: 1,
      mid: 0.92,
      low: 0.72,
    },
    /**
     * Same/adjacent netGuard multiplier by strike line.
     * Low attacks punch through cover a bit more for parry purposes.
     */
    parryGuardByStrikeLine: {
      high: 1,
      mid: 0.95,
      low: 0.78,
    },
    /**
     * Inherent cover bias on defense performance (chance + player QTE ease).
     * coverHigh favors parry; coverLow favors dodge; coverMid is neutral (1).
     */
    coverHighParryMult: 1.1,
    coverLowDodgeMult: 1.1,
  },

  /**
   * Flat skill rank gains on a *connected* hit (rhythm miss skips these).
   * Not formulaic / no diminishing returns yet — pure additives so you can
   * retune burn rate during playtest without hunting magic numbers in code.
   */
  training: {
    /** Equipped weapon type rank += this (attacker). */
    weaponSkillBumpOnHit: 0.05,
    /** Attacker's used strike stance rank += this. */
    strikeSkillBumpOnHit: 0.05,
    /** Defender's used cover stance rank += this. */
    coverSkillBumpOnHit: 0.05,
  },

  /**
   * Stamina costs (points on staminaCurrent / staminaCap scale).
   * Attacker: swinging. Defender (now): absorbing a landed hit.
   * Dodge/parry helpers are stubs for the future QTE layer.
   */
  stamina: {
    /** Base cost to throw a basic attack. */
    attackBasic: 0.22,
    /** Extra burden from carried gear vs body weight. */
    attackGearBurden: 1,
    /** How hard oversized weapons tax stamina (weaponWeight / strength). */
    attackOversizeScale: 0.35,
    /** Two-handing / optional two-hand effort bump. */
    attackTwoHandMult: 1.12,
    /** Floor so a jab still costs something. */
    attackMin: 0.08,

    /** Base shock of being hit. */
    takeHitBasic: 0.35,
    /** Scales with attacker attackValue (normalized softly). */
    takeHitForceScale: 0.045,
    /** How much part vitality weight amplifies shock (neck >> foot). */
    takeHitVitalityScale: 0.55,
    /** Soft armor / bare flesh: more kinetic shock than plate. */
    takeHitSoftShockMult: 1.35,
    takeHitHardShockMult: 0.85,
    takeHitMin: 0.12,

    /** Future QTE — precise dodge (“moved just enough”). */
    dodgePrecise: 0.12,
    /** Future QTE — sloppy but successful dodge (big scramble). */
    dodgeSloppy: 0.38,
    /** Future QTE — clean parry. */
    parryClean: 0.14,
    /** Future QTE — edge parry (barely caught). */
    parryEdge: 0.28,
    /** Parry vs much stronger attacker: × sqrt(atkCon/defCon) capped. */
    parryConDiffScale: 1,
    /** Successful shield block (old attackBlocked). */
    blockBasic: 0.2,
    /** × sqrt(atkCon/defCon) on block stam. */
    blockConDiffScale: 1,
    blockMin: 0.08,
  },

  /** Shield durability loss on successful block (port CalcShieldDurabilityLoss). */
  shieldWearScale: 0.05, // old /20 → 0.05
} as const;
