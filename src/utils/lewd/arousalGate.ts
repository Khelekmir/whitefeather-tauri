import {
  arousalSoftCapForErogenous,
  erogenousRank,
} from './erogenous';
import { LEWD_TUNING as T } from './lewdTuning';

export type ArousalReadiness = 'ok' | 'softUnready' | 'hardUnready';

/**
 * How much arousal the recipient needs before this act/target feels welcome.
 * Light kisses/holds → ~0; deep penetration / intense genital → high 60s–70s.
 *
 * When `targetCatalogSensitivity` is provided, required is clamped so the act
 * cannot demand more meter than the zone’s soft-cap can sustain
 * (`softCap − softSlack`). Prevents kissTongue-on-mouth style traps where
 * intimacy math asks for ~56 but the zone caps ~44.
 */
export function requiredArousalForAct(
  actionIntimacy: number,
  targetIntimacy: number,
  targetCatalogSensitivity?: number
): number {
  const G = T.arousalGate;
  const fromAct =
    Math.max(0, actionIntimacy - G.softActIntimacy) * G.arousalPerActIntimacy;
  const fromTarget =
    Math.max(0, targetIntimacy - G.targetIntimacyBonusStart) *
    G.arousalPerTargetIntimacy;
  let required = Math.min(G.maxRequired, fromAct + fromTarget);

  if (targetCatalogSensitivity != null && targetCatalogSensitivity > 0) {
    const softCap = arousalSoftCapForErogenous(
      erogenousRank(targetCatalogSensitivity)
    );
    // Leave room so “ok” at the ceiling isn’t instantly soft-unready on a dip.
    const sustainMax = Math.max(0, softCap - G.softSlack);
    required = Math.min(required, sustainMax);
  }

  return required;
}

/**
 * ♀ testosterone slightly lowers required arousal for lewd acts.
 * T is ~1–2.8 (not E-scale); linear (T−1) is appropriate.
 */
export function testosteroneRequiredMult(testosterone: number): number {
  const M = T.arousalGate.testosteroneRequiredMult;
  const t = Math.max(0.5, testosterone);
  return Math.max(M.min, Math.min(M.max, 1 - M.weight * (t - 1)));
}

/**
 * Openness credit after climaxes — used only for the readiness gate,
 * not added to the visible arousal meter.
 */
export function afterglowGateCredit(
  climaxCount: number,
  receptivity: number
): number {
  if (!(climaxCount > 0)) return 0;
  const A = T.arousalGate.afterglow;
  const fromClimaxes =
    A.creditFirstClimax + Math.max(0, climaxCount - 1) * A.creditPerExtraClimax;
  const fromRecv = Math.max(0, receptivity - 1) * A.receptivityCreditPerUnit;
  return Math.min(A.creditCap, fromClimaxes + fromRecv);
}

/** Arousal as seen by the gate (meter + afterglow openness). */
export function effectiveArousalForGate(
  currentArousal: number,
  climaxCount: number,
  receptivity: number
): number {
  return (
    currentArousal + afterglowGateCredit(climaxCount, receptivity)
  );
}

export function evaluateArousalReadiness(
  currentArousal: number,
  required: number,
  opts?: { climaxCount?: number; receptivity?: number }
): ArousalReadiness {
  if (required <= 0.5) return 'ok';
  const effective = effectiveArousalForGate(
    currentArousal,
    opts?.climaxCount ?? 0,
    opts?.receptivity ?? 1
  );
  if (effective >= required) return 'ok';
  if (effective >= required - T.arousalGate.softSlack) return 'softUnready';
  return 'hardUnready';
}
