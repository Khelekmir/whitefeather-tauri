import type { DirectedRelationship } from '../../data/social/relationships';
import type { Sex, Unit as DetailedUnit } from '../../types/characters';

type AttractionUnit = Pick<DetailedUnit, 'sex' | 'lewdStats'>;

/**
 * Design hard ban: no M→M erotic content (authorial gate).
 */
export function sexualPairingHardBlocked(
  from: Pick<AttractionUnit, 'sex'>,
  to: Pick<AttractionUnit, 'sex'>
): boolean {
  return from.sex === 'M' && to.sex === 'M';
}

/**
 * Native / cultural attraction.
 * Whitewing (Ilian sapphic culture) and Whitefeather (inducted / practicing)
 * both count as attraction toward women.
 */
export function hasNativeAttractionToward(
  from: AttractionUnit,
  to: Pick<AttractionUnit, 'sex'>
): boolean {
  if (sexualPairingHardBlocked(from, to)) return false;
  const s = from.lewdStats.static;
  if (to.sex === 'F') {
    return !!(s.attractedToGirls || s.whitefeather || s.whitewing);
  }
  if (to.sex === 'M') return !!s.attractedToBoys;
  return false;
}

/**
 * Soft desire / desireHeat cap (0–100).
 *
 * - M→M → 0
 * - Native attraction → 100
 * - F→F without native flags → erodable via closeness (affection, familiarity,
 *   trust, warmth). Caps well below full lovers until whitefeather / flag flip.
 * - Other mismatches → 0
 */
export function sexualDesireSoftCap(
  from: AttractionUnit,
  to: Pick<AttractionUnit, 'sex'>,
  edge?: DirectedRelationship | null
): number {
  if (sexualPairingHardBlocked(from, to)) return 0;
  if (hasNativeAttractionToward(from, to)) return 100;

  if (from.sex === 'F' && to.sex === 'F') {
    const lt = edge?.longTerm;
    const st = edge?.shortTerm;
    const closeness =
      ((lt?.affection ?? 0) +
        (lt?.familiarity ?? 0) +
        (lt?.trust ?? 0) * 0.4) /
        220 +
      (st?.warmth ?? 0) / 180;
    // Skinship / bond can chip openness up to ~38 until induction flips flags.
    return Math.round(Math.min(38, Math.max(0, closeness * 42)));
  }

  return 0;
}

/**
 * 0 = open, 1 = fully resistant.
 * Used to damp psych / intimacy when F→F play precedes native attraction.
 */
export function orientationResistance01(
  from: AttractionUnit,
  to: Pick<AttractionUnit, 'sex'>,
  edge?: DirectedRelationship | null
): number {
  if (sexualPairingHardBlocked(from, to)) return 1;
  if (hasNativeAttractionToward(from, to)) return 0;
  if (from.sex === 'F' && to.sex === 'F') {
    const cap = sexualDesireSoftCap(from, to, edge);
    return Math.max(0, Math.min(1, 1 - cap / 38));
  }
  return 1;
}

/** Intimate encounter allowed at all (soft resistance may still apply). */
export function intimateEncounterAllowed(
  from: Pick<AttractionUnit, 'sex'>,
  to: Pick<AttractionUnit, 'sex'>
): boolean {
  return !sexualPairingHardBlocked(from, to);
}

export function sexualDesireAllowedBySex(
  fromSex: Sex,
  toSex: Sex,
  attractedToBoys: boolean,
  attractedToGirls: boolean,
  opts?: { whitefeather?: boolean; whitewing?: boolean }
): boolean {
  if (fromSex === 'M' && toSex === 'M') return false;
  if (toSex === 'F') {
    return !!(
      attractedToGirls ||
      opts?.whitefeather ||
      opts?.whitewing
    );
  }
  if (toSex === 'M') return attractedToBoys;
  return false;
}
