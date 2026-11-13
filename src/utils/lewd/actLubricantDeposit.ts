/**
 * Act lubricant deposits into orificeSlick.
 * Live: saliva from tongue/lips on orifice targets; oil via Lab/inventory helper.
 * Deferred: partner precum/semen act deposits into orifice (climax soil path is separate).
 */

import type { Unit as DetailedUnit } from '../../types/characters';
import type { LewdChannel } from './lewdChannels';
import { LEWD_TUNING as T } from './lewdTuning';
import {
  orificeFamilyFromTarget,
  orificeIdForFamily,
} from './orificePlayState';
import {
  addOrificeSlickLayer,
  blendOrificeSlick,
  type LubricantKind,
  type OrificeId,
  type OrificeSlickById,
} from './orificeSlick';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

const SALIVA_ACTORS = new Set(['tongue', 'lips']);

function isSalivaActor(actorPart: string): boolean {
  return (
    SALIVA_ACTORS.has(actorPart) ||
    /^tongue/i.test(actorPart) ||
    actorPart === 'lips'
  );
}

function setOrificeSlick(
  unit: DetailedUnit,
  slick: OrificeSlickById
): DetailedUnit {
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: {
        ...unit.lewdStats.dynamic,
        orificeSlick: slick,
      },
    },
  };
}

export function depositLubricantOnOrifice(
  unit: DetailedUnit,
  orifice: OrificeId,
  kind: LubricantKind,
  amount01: number,
  quality01?: number
): { unit: DetailedUnit; deposited01: number; wet01: number; quality01: number } {
  const amt = Math.max(0, amount01);
  if (amt <= 1e-6) {
    const blend = blendOrificeSlick(unit.lewdStats.dynamic.orificeSlick?.[orifice]);
    return {
      unit,
      deposited01: 0,
      wet01: blend.wet01,
      quality01: blend.quality01,
    };
  }
  const prev = unit.lewdStats.dynamic.orificeSlick ?? {};
  const layers = addOrificeSlickLayer(prev[orifice], kind, amt, quality01);
  const next = setOrificeSlick(unit, { ...prev, [orifice]: layers });
  const blend = blendOrificeSlick(layers);
  return {
    unit: next,
    deposited01: amt,
    wet01: blend.wet01,
    quality01: blend.quality01,
  };
}

/** Apply purpose / improvised oil onto an orifice (Lab or inventory). */
export function applyOrificeOil(
  unit: DetailedUnit,
  orifice: OrificeId,
  kind: 'oilRefined' | 'oilImprovised' = 'oilRefined',
  amount01?: number
): { unit: DetailedUnit; note: string; wet01: number; quality01: number } {
  const Oil = T.actDeposits.oil;
  const amt =
    amount01 ??
    (kind === 'oilRefined' ? Oil.refinedAmount01 : Oil.improvisedAmount01);
  const r = depositLubricantOnOrifice(unit, orifice, kind, amt);
  const label = kind === 'oilRefined' ? 'refined oil' : 'improvised oil';
  return {
    unit: r.unit,
    note: `applied ${label} to ${orifice} · slick ${(r.wet01 * 100).toFixed(0)}% q${(r.quality01 * 100).toFixed(0)}`,
    wet01: r.wet01,
    quality01: r.quality01,
  };
}

export interface ActDepositLine {
  orifice: OrificeId;
  kind: LubricantKind;
  amount01: number;
  actionId: string;
}

/**
 * Deposit saliva from tongue/lips channels onto mapped orifices.
 * Call before orifice comfort so the same beat can use the fresh film.
 */
export function applySalivaDepositsFromChannels(
  unit: DetailedUnit,
  channels: LewdChannel[],
  holdSeconds: number
): { unit: DetailedUnit; deposits: ActDepositLine[]; note: string | null } {
  const S = T.actDeposits.saliva;
  const holdScale = Math.pow(
    Math.max(0.25, holdSeconds / Math.max(0.5, T.defaultHoldSeconds)),
    S.holdScalePower
  );

  const byOrifice = new Map<OrificeId, number>();
  const lines: ActDepositLine[] = [];

  for (const ch of channels) {
    if (!isSalivaActor(ch.actorPart)) continue;
    const actionMult =
      S.actionMult[ch.actionId as keyof typeof S.actionMult] ?? 0;
    if (actionMult <= 0) continue;
    const family = orificeFamilyFromTarget(ch.targetPart);
    if (!family) continue;
    // Mouth receiving tongue is normal; still deposit saliva into mouth slick.
    const orifice = orificeIdForFamily(family);
    const intensity01 = clamp01(
      (Math.max(1, ch.intensity) || 5) / S.intensityDivisor
    );
    const amt = S.baseAmount01 * actionMult * intensity01 * holdScale;
    if (amt <= 1e-6) continue;
    byOrifice.set(orifice, (byOrifice.get(orifice) ?? 0) + amt);
    lines.push({
      orifice,
      kind: 'saliva',
      amount01: amt,
      actionId: ch.actionId,
    });
  }

  if (byOrifice.size === 0) {
    return { unit, deposits: [], note: null };
  }

  let next = unit;
  const applied: ActDepositLine[] = [];
  let total = 0;
  for (const [orifice, rawAmt] of byOrifice) {
    const remaining = Math.max(0, S.perBeatCap01 - total);
    if (remaining <= 1e-6) break;
    const amt = Math.min(rawAmt, remaining);
    const r = depositLubricantOnOrifice(next, orifice, 'saliva', amt);
    next = r.unit;
    total += amt;
    applied.push({
      orifice,
      kind: 'saliva',
      amount01: amt,
      actionId: lines.find((l) => l.orifice === orifice)?.actionId ?? 'lick',
    });
  }

  const bits = applied.map(
    (d) => `${d.orifice}+saliva ${(d.amount01 * 100).toFixed(0)}%`
  );
  return {
    unit: next,
    deposits: applied,
    note: bits.length ? `deposit ${bits.join(' · ')}` : null,
  };
}
