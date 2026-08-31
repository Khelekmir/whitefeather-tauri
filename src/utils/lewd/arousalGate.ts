import { LEWD_TUNING as T } from './lewdTuning';

export type ArousalReadiness = 'ok' | 'softUnready' | 'hardUnready';

/**
 * How much arousal the recipient needs before this act/target feels welcome.
 * Light kisses/holds → ~0; deep penetration / intense genital → high 60s–70s.
 */
export function requiredArousalForAct(
  actionIntimacy: number,
  targetIntimacy: number
): number {
  const G = T.arousalGate;
  const fromAct =
    Math.max(0, actionIntimacy - G.softActIntimacy) * G.arousalPerActIntimacy;
  const fromTarget =
    Math.max(0, targetIntimacy - G.targetIntimacyBonusStart) *
    G.arousalPerTargetIntimacy;
  return Math.min(G.maxRequired, fromAct + fromTarget);
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
