import { LEWD_TUNING as T } from './lewdTuning';

/**
 * Brief Lab flavor for felt vaginal wetness, scaled to what idle drip
 * would do to undergarments over time (not orgasm/play bursts).
 *
 * Anchors use arousalDrip thresholds + wet-point bands:
 * pinprick ~4 · coin ~12 · palm ~28 · underwear capacity ~48.
 */
export function describeFeltWetnessFlavor(feltWetness: number): string {
  const D = T.cycle.arousalDrip;
  const cap = T.cycle.wetnessCap;
  const ready = T.cycle.readinessWetness;
  const thr = D.soilFromWetnessThreshold;
  const felt = Math.max(0, feltWetness);

  if (felt < thr) {
    return 'Quiet inside; an idle hour leaves her undergarment dry.';
  }

  const intensity =
    (felt - thr) / Math.max(0.01, cap - thr);
  const ptsPerHour = D.amountPerHourAtCap * intensity * 100;

  // Below ~1 wet point/hour: hours of wear still won't mark cloth.
  if (ptsPerHour < 1.2) {
    return 'A thin inward slick; panties would stay dry through hours of idle wear.';
  }
  // ~1–2.5 pts/h: one hour still under pinprick (~4).
  if (ptsPerHour < 2.5) {
    return 'Lightly lubricated; a full idle hour barely kisses the panty crotch.';
  }
  // ~2.5–4 pts/h: pinprick in ~1–1.5h, coin in several hours.
  if (ptsPerHour < 4) {
    return 'Noticeable slick; a damp hint may show after an hour or two of idle wear.';
  }
  // Near readiness (~4–6 pts/h): coin in ~2–3h; 1h is still only a light mark.
  if (felt < ready + 0.08) {
    return 'Penetration-ready slick; a coin of damp can form over a couple of idle hours—not a soaked panel yet.';
  }
  // Mild oversat (~6–8 pts/h): clear coin within ~1–2h.
  if (ptsPerHour < 8) {
    return 'Oversaturated; within an hour or two her panties take a clear damp patch.';
  }
  // Strong oversat (~8–10.5): palm in a few hours; capacity in ~5–6h.
  if (ptsPerHour < 10.5) {
    return 'Heavy slick; an idle hour leaves a broad damp, and longer wear pushes toward soaking the crotch panel.';
  }
  // Near cap: capacity / seepage on a workday timescale.
  return 'Flooded; idle drip fills the crotch fast enough that outer cloth can dampen after a few hours if she stays dressed.';
}
