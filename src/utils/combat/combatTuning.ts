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
  bleedToBloodLossScale: 0.022,
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
   * Stance matchup (cover vs strike). Window factor is logged as a preview —
   * Battleground still assumes 100% hit. Body-part remap is live.
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
    skillBump: 0.05,
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
  },
} as const;
