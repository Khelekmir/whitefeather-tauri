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
  /**
   * Global melee attackValue scale (wired in calcMainhandAttackValue).
   * ×2 retune: solid hits deal ~double wound energy; hard armor wear rises ~√2.
   */
  physicalConstant: 2,
  armorEffectiveness: 1,

  /**
   * Glancing blow — multiplies wound energy AFTER log mitigation.
   * Class from outermost template with armorClass (skip cloth / unclassed).
   * Partial coverage: glance applies with probability = coverage.
   */
  glancingBlow: {
    plate: {
      slash: 0.4,
      thrust: 0.4,
      projectile: 0.4,
      /** Blunt + unarmed (treated as blunt). */
      blunt: 0.7,
    },
    chainmail: {
      slash: 0.55,
      /** Non-bodkin arrows only. */
      projectile: 0.55,
    },
    leather: {
      slash: 0.7,
      /** Non-bodkin arrows. */
      projectile: 0.85,
    },
  },

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
   * part.health = wound; part.bleed / internalBleed = intensities;
   * bloodLoss = liters lost from synthesized blood volume.
   *
   * Calibration: one fully ruined undressed **arterial** part (neck:
   * rate = maxBleedRate×(tier/10) = 10×1 = 10) loses
   * `10 × 5 × bleedToBloodLossScale` liters in 5 minutes.
   * With scale 0.04 → **2.0 L** ≈ 40% of a ~5 L adult volume (critical /
   * realistically fatal without care).
   */
  bleedToBloodLossScale: 0.04,
  /**
   * Direct stamina point drain per (bleedRate × minute), on top of
   * blood-fraction stamina *effectiveness* penalties.
   */
  bleedToStaminaScale: 0.35,
  /**
   * Blood loss → stamina effectiveness / collapse / death.
   * Collapse (faint): stamina → 0 at collapseLostFraction (~40%).
   * Death: at deathLostFraction (~50%) — PCs die; enemies later share this gate.
   */
  bloodStamina: {
    /** Faint / unconscious — stamina factor 0 + pool depleted. */
    collapseLostFraction: 0.4,
    /** Character death from exsanguination. */
    deathLostFraction: 0.5,
    /** Curve exponent between full blood and collapse — higher = steeper plummet. */
    plummetExponent: 1.85,
    /** @deprecated use collapseLostFraction */
    fatalLostFraction: 0.4,
  },

  /**
   * Hypovolemia: bleed flow slows as blood is lost (no hard stop).
   * Non-arterial slows hard from collapse→death; arterial less so.
   * Slower flow also boosts clotting (hybrid with care clot mults).
   */
  hypovolemia: {
    /** Flow mult at collapse (40% lost) — mild slow for all. */
    flowAtCollapse: 0.72,
    /** Arterial flow mult at death threshold (50% lost). */
    arterialFlowAtDeath: 0.55,
    /** Non-arterial flow mult at 50% lost — significant slow. */
    nonArterialFlowAtDeath: 0.18,
    /** Floor — bleeding never fully capped off by hypovolemia alone. */
    flowFloor: 0.06,
    /** Beyond 50% lost, exponential ease toward floor. */
    postDeathDecay: 4,
    /**
     * Clot bonus from slow effective flow (care × hypo).
     * clot *= 1 + this × (1 − effectiveFlowMult).
     */
    clotBonusFromSlowFlow: 1.1,
  },
  /** Clotting: bleed intensity drop per minute when allowed to clot. */
  clotRatePerMinute: 0.01,
  /** Ruined fountain intensity ceiling (and fresh-ruin target). */
  unclottableRuinedIntensity: 1,
  /**
   * Undressed ruined + no pressure: cannot clot; intensity climbs back toward
   * full spray at this rate per minute (no instant snap to 1 on release).
   */
  ruinedBleedRelapsePerMinute: 0.2,
  /**
   * External bleed rate cuts (lower = slower spray).
   * Bandage and pressure both cut flow hard; bandage is slightly better alone.
   * Pressure-over-bandage compounds but must not trivialize arterial fountains.
   */
  dressedExternalRateMult: 0.22,
  /** External rate × when vulnerary applied. */
  vulneraryExternalRateMult: 0.25,
  /** Hand pressure alone — significant flow control, slightly weaker than bandage. */
  pressureExternalRateMult: 0.3,
  /** When dressed + pressure: further × on top of dressedExternalRateMult. */
  pressureOverBandageRateMult: 0.72,
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
   * Bruising — lasting contusion deposited by internal trauma.
   * Active internalBleed: little/no fade (optional settle-up).
   * Cleared bleed: day-scale fade; deeper bruises linger longer.
   * Vulnerary keeps a strong ×4 accelerate (other remedies later).
   */
  bruise: {
    /** damagePercent × internalFrac × this → bruise deposit (max with current). */
    fromInternalMult: 1,
    /**
     * Resolution fade base (per minute) once internalBleed is cleared.
     * Effective rate = resolutionFadePerMinute / (1 + bruise × lingerCurve).
     * Tuned so severe (~1) clears ~7–9 days unassisted; faint ~1 day.
     */
    resolutionFadePerMinute: 0.00021,
    /** Deep bruises linger: divides fade rate by (1 + bruise × this). */
    lingerCurve: 3,
    /** While vulnerary on part — strong care option (other remedies later). */
    vulneraryFadeMult: 4,
    /**
     * While internalBleed above this, skip resolution fade and allow settle.
     */
    activeInternalThreshold: 0.02,
    /**
     * Optional settle while still bleeding: bruise += internalBleed × this × dt.
     * Models blood pooling into tissue; capped at 1.
     */
    settleFromInternalPerMinute: 0.004,
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
   * Weapon-arm integrity → attack power; handedness / offhand skill tax.
   * See limbAttack.ts. Ruined shoulder/upper/lower/hand on a side zeros that side.
   */
  limbAttack: {
    /** health^exp per arm part before geo-mean (higher → mild damage gentler? no — higher hurts low health more). */
    partHealthExp: 1.35,
    /**
     * When the worst part on a side falls below this, side integrity is crushed
     * toward 0 (ruined limb ≈ useless).
     */
    ruinedPartCutoff: 0.02,
    /** Worst-part crush: 0 at ruinedPartCutoff → 1 at this health. */
    significantPartHealth: 0.45,
    /** Floor on limb mult before one-hand fallback (never fully NaN). */
    limbMultFloor: 0,
    /**
     * Two-hand grip uses min(left, right). If that drops ≤ this, try one-hand
     * fallback with the healthy arm when STR/CON can carry the weight.
     */
    oneHandFallbackBelow: 0.22,
    /** Power retained when forced to one-hand a two-hander (before STR feasibility). */
    oneHandPowerMult: 0.55,
    /**
     * Feasible when strength + 0.35×CON >= weaponWeight × this.
     * Tuned so knights can one-hand a longsword awkwardly; bows/heavy 2h need more STR.
     */
    oneHandBurdenFactor: 1.15,
    /** Soften feasibility: at exact burden threshold → this mult; above → up to 1. */
    oneHandFeasibilityFloor: 0.35,
    /** Base skill mult for weapons in the non-dominant slot (0.5 = −50%). */
    offhandSkillMult: 0.5,
  },

  /**
   * Eyes / ears → accuracy; head concussion → skill performance (any arena).
   * See sensoryPerformance.ts. Concussion flag syncs when head.health ≤ threshold.
   */
  sensory: {
    /** head.health at or below this → concussed. */
    concussionHealthThreshold: 0.5,
    /** Skill mult exactly at the concussion threshold (immediate fog). */
    concussionSkillAtThreshold: 0.9,
    /**
     * Skill mult at head.health = 0.
     * Scales linearly from concussionSkillAtThreshold → this as head worsens.
     */
    concussionSkillFloor: 0.62,
    /** Per-eye contribution to accuracy degradation (1 − √health) × weight. */
    eyeAccuracyWeight: 0.55,
    /** Per-ear (balance) contribution to accuracy degradation. */
    earAccuracyWeight: 0.35,
    /** Floor on combined eye/ear accuracy mult. */
    accuracyFloor: 0.4,
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
    /**
     * Clot mults (on top of low base clotRatePerMinute).
     * Bandage = primary clot accelerator; pressure = minor clot help but strong rate cut.
     */
    bandageClotMult: 5.5,
    /** Vulnerary also clots. */
    vulneraryClotMult: 2.2,
    /** Hand pressure alone — minor clot accel. */
    pressureClotMult: 1.4,
    /** Modest compound when pressure is held over a bandage. */
    pressureOverBandageClotMult: 1.25,
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
      weaponWeight: 0.55,
      strikeWeight: 0.35,
      /** Base SKL — hand-eye / aptitude (slightly stronger than the old 0.05). */
      baseSkillWeight: 0.1,
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
   * Intrinsic attacker miss (competence only) — used after failed player
   * dodge/parry so NPC swings can still whiff. Never 0; never above max.
   * competence 0 → missChanceMax; competence 1.25 → missChanceMin.
   */
  attackerMiss: {
    missChanceMin: 0.04,
    missChanceMax: 0.33,
  },

  /**
   * Player defender QTE (Dodge / Parry) — reuses shrinking-square visuals.
   * Battleground: left = player; NPC→Player uses this instead of NPC %.
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
     * Attacker rhythm competence (weapon + strike + SKL) pressures the defender.
     * High competence → tighter bands + faster collapse (harder dodge/parry).
     */
    attackerCompetenceBandFloor: 0.28,
    /** duration /= 1 + competence × this (competence ~0..1.25). */
    attackerCompetenceHaste: 0.42,
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
   * Shield block absorb + arm overload (see resolveShieldBlock.ts).
   * Successful block always covers the aimed part (0 wound there).
   * Overload dumps into shield-side lowerArm as bruise / trauma flags.
   *
   * Baseline: pristine steel heater capacity ≈ equal-STR 1h sword attackValue
   * (flat block). Heavy axe / lance should overload a flat heater block.
   * Redirecting block (superior QTE) counts overload at redirectOverloadMult.
   */
  shieldBlock: {
    /** Global multiply on calcBlockStats.value (headroom above equal sword). */
    blockValueScale: 1.05,
    /** Offhand shield → this arm (v1: left; no handedness yet). */
    shieldArmPart: 'lowerArmLeft' as const,
    /**
     * excessRatio = max(0, atk/capacity − 1), then × redirectOverloadMult for redirect.
     * Bands: (0, bruiseMax] bruise only; … sprain; … fracture; above → broken.
     */
    bruiseMax: 0.3,
    sprainMax: 0.65,
    fractureMax: 1.15,
    /** Redirecting block: only this fraction of excess counts toward overload. */
    redirectOverloadMult: 0.5,
    /**
     * Absolute attackValue floors for trauma flags (weak vs weak cannot fracture).
     * Bruise can still apply from comparative overload below these floors.
     */
    sprainMinAtk: 18,
    fractureMinAtk: 30,
    brokenMinAtk: 42,
    /** Arm bruise deposit: min(1, max(current, excessEff × this)). */
    bruiseFromOverloadScale: 0.85,
    bruiseFromOverloadFloor: 0.12,
  },

  /**
   * Player shield-block QTE — fires after dodge/parry fail or cancel when shielded.
   * `calcBlockStats.chance` (after attempt/legs modifiers) scales bands & duration;
   * strike-vs-cover `windowFactor` eases/tightens; shield size only via chance.
   * Master difficulty: raise `playerEase` to widen the window; lower to tighten.
   * Crit band → redirecting block; hit band → flat block (see shieldBlock).
   */
  blockRhythm: {
    /**
     * Master ease on player block QTE (>1 easier, <1 harder).
     * Starts generous: injury / stamina / prior-attempt taxes tighten later.
     */
    playerEase: 1.4,
    durationMs: 1100,
    startScale: 2.6,
    endScale: 0.55,
    critBand: 0.035,
    hitBand: 0.16,
    rotationDegrees: 220,
    /**
     * Maps adjusted block chance → band width.
     * chance 0 → chanceBandFloor × base; chance ~0.95 → full base × playerEase.
     */
    chanceBandFloor: 0.22,
    /** Same idea for collapse duration. */
    chanceDurationFloor: 0.48,
    /** Chance reference that maps to “full” window (matches block clamp). */
    chanceFullAt: 0.95,
    /** Mistimed dodge press before the block QTE. */
    afterDodgeAttemptMult: 0.55,
    /** Mistimed parry press before the block QTE (buckler exempt). */
    afterParryAttemptMult: 0.65,
    /** Attacker aimed legLeft / legRight. */
    legsAimMult: 0.5,
    /** Attacker competence pressures the block window (same shape as defense). */
    attackerCompetenceBandFloor: 0.28,
    attackerCompetenceHaste: 0.42,
    /**
     * Strike vs cover `windowFactor` → block QTE ease.
     * Guarded line (wf &lt; 1): wider/slower block. Opposite (wf &gt; 1): tighter/faster.
     * band/duration *= 1 + (1 − wf) × this.
     */
    stanceWindowInfluence: 0.85,
    /** Floor so opposite-line blocks never collapse to nothing. */
    stanceBandMultFloor: 0.55,
    stanceDurationMultFloor: 0.65,
  },

  /**
   * Attacker weapon-type feel.
   * - dodgeChanceAdd / parryChanceAdd: flat additives on final 0–1 defense chances
   *   (then clamp 0–0.95). Also ease/tighten player dodge/parry QTE bands.
   * - armorWearMult / softArmorWearMult: gear chip only — wound damage unchanged.
   */
  weaponTypeFeel: {
    /**
     * QTE: band *= max(floor, 1 + chanceAdd × this).
     * +0.08 dodge → ~×1.16 bands at 2.0.
     */
    qteBandPerChancePoint: 2,
    qteDurationPerChancePoint: 1.4,
    qteBandMultFloor: 0.55,
    qteDurationMultFloor: 0.65,
    byWeaponType: {
      // Daggers — quick / short: easier to slip.
      dagger: { dodgeChanceAdd: 0.08 },
      throwingKnife: { dodgeChanceAdd: 0.08 },
      // Swords — harder to dodge, cleaner to catch on the blade.
      '1hSword': { dodgeChanceAdd: -0.06, parryChanceAdd: 0.08 },
      '2hSword': { dodgeChanceAdd: -0.06, parryChanceAdd: 0.08 },
      // Axes — chew armor / kit harder.
      '1hAxe': { armorWearMult: 1.4, softArmorWearMult: 1.35 },
      '2hAxe': { armorWearMult: 1.45, softArmorWearMult: 1.4 },
      throwingAxe: { armorWearMult: 1.35, softArmorWearMult: 1.3 },
      // Blunt — impact wounds, light on shredding cloth / pacing plate.
      '1hMace': { armorWearMult: 0.45, softArmorWearMult: 0.18 },
      '2hMace': { armorWearMult: 0.5, softArmorWearMult: 0.2 },
      flail: { armorWearMult: 0.48, softArmorWearMult: 0.2 },
      staff: { armorWearMult: 0.35, softArmorWearMult: 0.12 },
      shield: { armorWearMult: 0.4, softArmorWearMult: 0.15 },
      // Lances — long telegraph, awkward to catch cleanly.
      lance: { dodgeChanceAdd: 0.1, parryChanceAdd: -0.12 },
      ilianLance: { dodgeChanceAdd: 0.1, parryChanceAdd: -0.12 },
      javelin: { dodgeChanceAdd: 0.08, parryChanceAdd: -0.1 },
      unequipped: {},
    } as Record<
      string,
      {
        dodgeChanceAdd?: number;
        parryChanceAdd?: number;
        armorWearMult?: number;
        softArmorWearMult?: number;
      }
    >,
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
   * Ranged / bow lab — bands 1–5, meters under the hood.
   * Melee attacks only legal at band 1.
   */
  ranged: {
    bandMeters: {
      1: 8,
      2: 20,
      3: 35,
      4: 55,
      5: 80,
    } as Record<number, number>,
    /** Minimum drawFrac even for weak shooters. */
    drawFracMin: 0.35,
    /** Accuracy clamps. */
    accuracyMin: 0.08,
    accuracyMax: 0.95,
    /** Skill→accuracy: log pivot for weapon rank. */
    accuracySkillPivot: 120,
    /** Soft AGI contribution to accuracy (0–1 weight). */
    accuracyAgiWeight: 0.15,
    /** Distance penalty: at edge of personal max band, × this. */
    accuracyAtMaxRange: 0.55,
    /** Under-draw accuracy soft mult floor. */
    accuracyDrawFloor: 0.7,
    /** Damage falloff: (1 - k × meters/maxMeters)^p */
    falloffK: 0.55,
    falloffP: 1.35,
    /** Heavy arrows fall off slightly more with distance. */
    heavyMassFalloffExtra: 0.12,
    /** Draw energy scale into attack-value units. Matched to physicalConstant ×2 retune. */
    drawEnergyScale: 1.1,
    /** Mass coupling: impact × (massCouplingBias + mass). */
    massCouplingBias: 0.65,
    /** Draw stamina: cost ∝ drawWeight × drawFrac / CON soft. */
    drawStaminaScale: 0.012,
    drawStaminaMin: 0.15,
    /**
     * Extra accuracy tax for non-chest aims.
     * raw = lerp(close, far, bandT) × difficulty; then skill shrinks it.
     */
    aimPrecision: {
      closeMaxPenalty: 0.08,
      farMaxPenalty: 0.55,
      /** How much of the raw tax skill can erase (0–1). */
      skillRelief: 0.85,
      precisionFloor: 0.25,
      difficulty: {
        head: 1,
        stomach: 0.35,
        groin: 0.45,
        armLeft: 0.7,
        armRight: 0.7,
        legLeft: 0.65,
        legRight: 0.65,
      } as Record<string, number>,
    },
    /**
     * Chest center-mass splash: fringe share of hit-ratio mass that can
     * clip extremities (grows with band, shrinks with skill).
     */
    chestSplash: {
      fringeClose: 0.06,
      fringeFar: 0.16,
      groupingRelief: 0.5,
    },
  },

  /**
   * Aim spill: skill discrepancy shifts weight between aim-core parts and
   * spill (arms/shoulders spoiling a chest line, etc.).
   * Attacker: weapon skill + base SKL. Defender: active cover stance rank.
   */
  aimSpill: {
    /** Soft-cap for log weapon-skill factor. */
    weaponSkillSoftCap: 280,
    /** SKL 1–30 contribution weight vs weapon factor (0–1 of combined atk score). */
    sklWeight: 0.35,
    /** Soft-cap for defender cover stance rank. */
    coverSkillSoftCap: 280,
    /**
     * How hard skill delta shifts spill vs base table.
     * spillShare' = baseSpillShare × (1 − delta × this), then × mult clamps.
     * delta = atkScore − defScore in roughly −1…+1.
     */
    spillShiftPerDelta: 0.65,
    /** Relative to base spill share (skilled attacker / spoiling defender). */
    spillShareMinMult: 0.5,
    spillShareMaxMult: 1.35,
    /** Absolute safety clamps on final spill fraction. */
    spillShareAbsMin: 0.05,
    spillShareAbsMax: 0.9,
  },

  /**
   * Heart / lung pierce from thrust that clears hard chest armor.
   * Dagger→heart: opposite stance only; SKL 1–30 linear hard cap;
   * weapon proficiency soft-caps with diminishing returns.
   */
  organPierce: {
    /** SKL scale for hard cap (stat is 1–30). */
    skillMin: 1,
    skillMax: 30,
    /** Max dagger-heart chance at SKL 30 with full proficiency. */
    daggerHeartMaxAtSkill30: 0.48,
    /** Dagger rank soft-cap for proficiency curve (diminishing returns). */
    daggerProfSoftCap: 280,
    /** General thrust lung chance scale × damagePercent × pierceFeel. */
    lungChancePerDamage: 0.22,
    /** Rare general heart chance (non-dagger-special) × damage × pierceFeel. */
    generalHeartChancePerDamage: 0.04,
    /** Integrity removed on a successful organ pierce. */
    organDamageOnPierce: 0.55,
    /** Bleed spikes when heart is pierced (external + internal). */
    heartExternalBleedSpike: 0.85,
    heartInternalBleedSpike: 0.95,
    /** Bleed spikes when a lung is pierced. */
    lungExternalBleedSpike: 0.15,
    lungInternalBleedSpike: 0.55,
    /** Strong stamina drain mult contribution from lung injury (per lung). */
    lungStaminaDrainPerInjury: 1.35,
    /** Floor for lung stamina mult when both lungs ruined. */
    lungStaminaDrainMax: 4,
    /** Weapon pierce feel (thrust weapons). Missing → 0.5. */
    pierceFeel: {
      dagger: 1.15,
      '1hSword': 0.75,
      '2hSword': 0.55,
      lance: 0.9,
      ilianLance: 0.95,
      javelin: 0.7,
      throwingKnife: 0.85,
      shortbow: 0.8,
      recurveBow: 0.85,
      longbow: 0.9,
      unequipped: 0.15,
    } as Record<string, number>,
  },

  /**
   * Flat skill rank gains on a *connected* hit (rhythm miss skips these).
   * Not formulaic / no diminishing returns yet — pure additives so you can
   * retune burn rate during playtest without hunting magic numbers in code.
   */
  training: {
    /** Equipped weapon type rank += this (attacker), × SKL aptitude. */
    weaponSkillBumpOnHit: 0.05,
    /** Attacker's used strike stance rank += this, × SKL aptitude. */
    strikeSkillBumpOnHit: 0.05,
    /** Defender's used cover stance rank += this, × defender SKL aptitude. */
    coverSkillBumpOnHit: 0.05,
    /**
     * Base SKL aptitude for training bumps (reuse rhythm statFactor curve).
     * Pivot SKL → ~1.0×; clamps keep dumps learning and geniuses bounded.
     */
    skillAptitudePivot: 12,
    skillAptitudeMin: 0.65,
    skillAptitudeMax: 1.45,
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
    /**
     * Successful shield block — force-scaled (see calcBlockStamina).
     * Legacy flat `blockBasic` kept as a small base under the √atk term.
     */
    blockBasic: 0.08,
    /** × √attackValue on block stam. */
    blockForceScale: 0.045,
    /** Extra stam × effective excessRatio when overloaded. */
    blockOverloadStamBonus: 0.55,
    /** × sqrt(atkCon/defCon) on block stam. */
    blockConDiffScale: 1,
    blockMin: 0.1,
  },

  /** Shield durability loss on successful block (port CalcShieldDurabilityLoss). */
  shieldWearScale: 0.05, // old /20 → 0.05
} as const;
