import type { DirectedRelationship } from '../../data/social/relationships';
import { LEWD_TUNING as T } from './lewdTuning';

export interface BondSnapshot {
  trust: number;
  affection: number;
  desire: number;
  familiarity: number;
  respect: number;
  warmth: number;
  desireHeat: number;
  hurt: number;
  irritation: number;
  suspicion: number;
  guilt: number;
}

export function bondFromEdge(edge: DirectedRelationship | null): BondSnapshot {
  if (!edge) {
    return {
      trust: 45,
      affection: 40,
      desire: 0,
      familiarity: 15,
      respect: 50,
      warmth: 0,
      desireHeat: 0,
      hurt: 0,
      irritation: 0,
      suspicion: 0,
      guilt: 0,
    };
  }
  const lt = edge.longTerm;
  const st = edge.shortTerm;
  return {
    trust: lt.trust,
    affection: lt.affection,
    desire: lt.desire,
    familiarity: lt.familiarity,
    respect: lt.respect,
    warmth: st.warmth,
    desireHeat: st.desireHeat,
    hurt: st.hurt,
    irritation: st.irritation,
    suspicion: st.suspicion,
    guilt: st.guilt,
  };
}

/**
 * How much relational "room" the recipient has for this partner's intimacy.
 * High trust/affection/desire (+ ST warmth/heat) expands; hurt/suspicion contracts.
 */
export function intimacyBudgetFromBond(
  bond: BondSnapshot,
  orientationResistance = 0
): number {
  const B = T.bond;
  const resist = Math.max(0, Math.min(1, orientationResistance));
  return (
    bond.trust * B.trustWeight +
    bond.affection * B.affectionWeight +
    bond.desire * B.desireWeight +
    bond.familiarity * B.familiarityWeight +
    (bond.warmth / 100) * B.warmthBonus +
    (bond.desireHeat / 100) * B.desireHeatBonus -
    (bond.hurt / 100) * B.hurtPenalty -
    (bond.irritation / 100) * B.irritationPenalty -
    (bond.suspicion / 100) * B.suspicionPenalty -
    (bond.guilt / 100) * B.guiltPenalty +
    B.budgetSlack -
    resist * B.orientationResistanceBudgetTax
  );
}

export function intimacyAllowedForAct(
  bond: BondSnapshot,
  intimacyRequired: number,
  orientationResistance = 0
): boolean {
  const budget = intimacyBudgetFromBond(bond, orientationResistance);
  return budget >= intimacyRequired * T.bond.requirementScale;
}

/**
 * Psych multiplier from bond × act intimacy.
 * Trusted partners get more charge from deep acts; cold partners get less / dampened.
 * Orientation resistance (F→F before native attraction) further damps charge.
 */
export function psychBondMultiplier(
  bond: BondSnapshot,
  actionIntimacy: number,
  orientationResistance = 0
): number {
  const B = T.bond;
  const depth = Math.max(0, Math.min(1, (actionIntimacy - 3) / 6));
  const closeness =
    (bond.trust + bond.affection) / 200 +
    bond.desire / 250 +
    bond.desireHeat / 400;
  // At depth 0 (light kiss): near 1. At depth 1 with cold bond: dampen; with warm: boost.
  const cold = Math.max(0, 0.55 - closeness);
  const warm = Math.max(0, closeness - 0.35);
  const resist = Math.max(0, Math.min(1, orientationResistance));
  const orientMult = 1 - resist * B.orientationResistancePsychPenalty;
  return (
    (1 +
      warm * B.psychWarmDeepBonus * depth -
      cold * B.psychColdDeepPenalty * depth) *
    orientMult
  );
}

/** Social mult for interest context (lighter than intimacy budget). */
export function socialMultFromBond(bond: BondSnapshot): number {
  return (
    0.65 +
    (bond.trust / 100) * 0.2 +
    (bond.affection / 100) * 0.2 +
    (bond.desire / 100) * 0.18 +
    (bond.desireHeat / 100) * 0.1 -
    (bond.hurt / 100) * 0.12 -
    (bond.suspicion / 100) * 0.1
  );
}
