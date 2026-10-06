/**
 * Wetness language by locus:
 * - Accumulation (how much / how far) for display bands
 * - Growth rate (how fast the stain or trail is changing) for narrative flavor
 *
 * Crotch panel = round accumulation (pinprick → soaked).
 * Legwear thigh/seat/hem = stain accumulation (hint → substantially wet).
 * Bare running skin = reach range (reached the thigh → down the calf) + form (bead → rivulets).
 * Tacky skin = smear accumulation (unchanged).
 */

/** Round damp patch on a crotch panel (underwear or leg crotch). */
export type CrotchBlossomSize =
  | 'none'
  | 'pinprick'
  | 'coin'
  | 'palm'
  | 'soaked';

/** Stain accumulation on legwear away from the crotch panel. */
export type ClothStainSize =
  | 'none'
  | 'hintOfDiscoloration'
  | 'noticeableDampness'
  | 'sizableStain'
  | 'substantiallyWet';

/**
 * How far a free-running film has traveled (standing / uncovered).
 * handsKnees stops at bottomOfThigh (knees on a surface — no calf run).
 */
export type BareSkinRange =
  | 'none'
  | 'reachedTheThigh'
  | 'partwayDownTheThigh'
  | 'bottomOfTheThigh'
  | 'downTheCalf';

/**
 * How far runoff has traveled along the rear trail (lying / seated).
 * Gravity: perineum → anal verge → cleft → cheeks → bed.
 * Anal verge is the future lubrication station (not full anal lube yet).
 */
export type BareSeatRange =
  | 'none'
  | 'alongThePerineum'
  | 'atTheAnalVerge'
  | 'atTheCleft'
  | 'downOverTheCheek'
  | 'towardTheBed';

/** Cross-section / volume form of a running film (for narrative). */
export type BareSkinForm =
  | 'none'
  | 'singleBead'
  | 'thinLine'
  | 'rivulets'
  | 'sheeting';

/** Contact-wick / post-undress residue on skin (does not run). */
export type SkinSmearSize =
  | 'none'
  | 'faintSmear'
  | 'tackyPatch'
  | 'smearedBand'
  | 'coated';

/** How fast a stain or trail is currently changing. */
export type WetGrowthRate =
  | 'clearlyEstablished'
  | 'slowlyCreeping'
  | 'steadilyExpanding'
  | 'swiftlyBlossoming';

export type SkinFilmFeel = 'running' | 'tacky';

export function crotchBlossomFromScore(score: number): CrotchBlossomSize {
  if (score < 4) return 'none';
  if (score < 12) return 'pinprick';
  if (score < 28) return 'coin';
  if (score < 55) return 'palm';
  return 'soaked';
}

export function clothStainFromScore(score: number): ClothStainSize {
  if (score < 4) return 'none';
  if (score < 12) return 'hintOfDiscoloration';
  if (score < 28) return 'noticeableDampness';
  if (score < 55) return 'sizableStain';
  return 'substantiallyWet';
}

export function bareSkinFormFromScore(score: number): BareSkinForm {
  if (score < 4) return 'none';
  if (score < 12) return 'singleBead';
  if (score < 28) return 'thinLine';
  if (score < 55) return 'rivulets';
  return 'sheeting';
}

export function skinSmearFromScore(score: number): SkinSmearSize {
  if (score < 4) return 'none';
  if (score < 12) return 'faintSmear';
  if (score < 28) return 'tackyPatch';
  if (score < 55) return 'smearedBand';
  return 'coated';
}

/**
 * Classify expansion rate from score delta (and optional deposit pressure).
 * - Small→large jump: swiftly blossoming
 * - Modest ongoing growth: steadily expanding
 * - Heavy deposit, little score move (saturated soak): slowly creeping
 * - Flat: clearly established
 */
export function growthRateFromDelta(
  prevScore: number,
  nextScore: number,
  opts?: { deposit01?: number }
): WetGrowthRate {
  const delta = nextScore - prevScore;
  if (delta < 1.2) return 'clearlyEstablished';
  const deposit = opts?.deposit01 ?? 0;
  // Lots of fluid pushed in but the visible stain barely grew → creeping into cloth.
  if (deposit >= 0.12 && delta < 5) return 'slowlyCreeping';
  if (prevScore < 14 && delta >= 8) return 'swiftlyBlossoming';
  if (delta >= 14) return 'swiftlyBlossoming';
  if (delta >= 5) return 'steadilyExpanding';
  return 'slowlyCreeping';
}

export function crotchBlossomLabel(size: CrotchBlossomSize): string {
  switch (size) {
    case 'pinprick':
      return 'pinprick';
    case 'coin':
      return 'coin';
    case 'palm':
      return 'palm';
    case 'soaked':
      return 'soaked';
    default:
      return 'dry';
  }
}

export function clothStainLabel(size: ClothStainSize): string {
  switch (size) {
    case 'hintOfDiscoloration':
      return 'hint of discoloration';
    case 'noticeableDampness':
      return 'noticeable dampness';
    case 'sizableStain':
      return 'sizable stain';
    case 'substantiallyWet':
      return 'substantially wet';
    default:
      return 'dry';
  }
}

export function bareSkinRangeLabel(range: BareSkinRange): string {
  switch (range) {
    case 'reachedTheThigh':
      return 'reached the thigh';
    case 'partwayDownTheThigh':
      return 'partway down the thigh';
    case 'bottomOfTheThigh':
      return 'to the bottom of the thigh';
    case 'downTheCalf':
      return 'down the calf';
    default:
      return 'dry';
  }
}

/** Active / present-tense reach cue (Lab short label). */
export function bareSeatRangeLabel(range: BareSeatRange): string {
  switch (range) {
    case 'alongThePerineum':
      return 'along the perineum';
    case 'atTheAnalVerge':
      return 'at the anal verge';
    case 'atTheCleft':
      return 'pooling at the cleft';
    case 'downOverTheCheek':
      return 'running down over the cheek';
    case 'towardTheBed':
      return 'running toward the bed';
    default:
      return 'dry';
  }
}

/** Static / established reach cue (clearlyEstablished narratives). */
export function bareSeatRangeEstablishedLabel(range: BareSeatRange): string {
  switch (range) {
    case 'alongThePerineum':
      return 'along the perineum';
    case 'atTheAnalVerge':
      return 'at the anal verge';
    case 'atTheCleft':
      return 'pooled at the cleft';
    case 'downOverTheCheek':
      return 'down over the cheek';
    case 'towardTheBed':
      return 'toward the bed';
    default:
      return 'dry';
  }
}

/** True once seat-trail fluid has reached the anal verge (anal-lube hook). */
export function seatTrailWetsAnalVerge(range: BareSeatRange): boolean {
  return (
    range === 'atTheAnalVerge' ||
    range === 'atTheCleft' ||
    range === 'downOverTheCheek' ||
    range === 'towardTheBed'
  );
}

export function bareSkinFormLabel(form: BareSkinForm): string {
  switch (form) {
    case 'singleBead':
      return 'single bead';
    case 'thinLine':
      return 'thin line';
    case 'rivulets':
      return 'rivulets';
    case 'sheeting':
      return 'sheeting';
    default:
      return 'dry';
  }
}

export function skinSmearLabel(size: SkinSmearSize): string {
  switch (size) {
    case 'faintSmear':
      return 'faint smear';
    case 'tackyPatch':
      return 'tacky patch';
    case 'smearedBand':
      return 'smeared band';
    case 'coated':
      return 'coated';
    default:
      return 'dry';
  }
}

export function growthRateLabel(rate: WetGrowthRate): string {
  switch (rate) {
    case 'swiftlyBlossoming':
      return 'swiftly blossoming';
    case 'steadilyExpanding':
      return 'steadily expanding';
    case 'slowlyCreeping':
      return 'slowly creeping';
    case 'clearlyEstablished':
      return 'clearly established';
  }
}

/** Legwear region → crotch blossom or thigh/seat stain accumulation. */
export function legRegionWetLabel(
  region: 'crotch' | 'seat' | 'innerThigh' | 'hem',
  score: number
): string {
  if (region === 'crotch') {
    return crotchBlossomLabel(crotchBlossomFromScore(score));
  }
  return clothStainLabel(clothStainFromScore(score));
}

/**
 * Farthest reach of a standing/handsKnees running trail from region scores.
 * handsKnees: calf ignored (knees on a supporting surface).
 */
export function bareThighRangeFromRegions(
  scores: { thighInner: number; calf: number },
  posture: string
): BareSkinRange {
  const allowCalf = posture !== 'handsKnees' && posture !== 'seated' && posture !== 'lying';
  if (allowCalf && scores.calf >= 4) return 'downTheCalf';
  if (scores.thighInner >= 40) return 'bottomOfTheThigh';
  if (scores.thighInner >= 16) return 'partwayDownTheThigh';
  if (scores.thighInner >= 4) return 'reachedTheThigh';
  return 'none';
}

/**
 * Seat / buttocks runoff reach (lying / seated / sideLying).
 * Score bands map perineum→verge→cleft→cheek→bed within skin filmCapacity (~14).
 */
export function bareSeatRangeFromScore(seatScore: number): BareSeatRange {
  if (seatScore < 3) return 'none';
  if (seatScore < 5.5) return 'alongThePerineum';
  if (seatScore < 8) return 'atTheAnalVerge';
  if (seatScore < 10.5) return 'atTheCleft';
  if (seatScore < 13) return 'downOverTheCheek';
  return 'towardTheBed';
}

export function skinRegionWetLabel(
  feel: SkinFilmFeel,
  score: number
): string {
  if (feel === 'tacky') {
    return skinSmearLabel(skinSmearFromScore(score));
  }
  // Short cue uses form; full narrative adds range + rate separately.
  return bareSkinFormLabel(bareSkinFormFromScore(score));
}

export type FluidContentsWord =
  | 'arousal fluid'
  | 'semen'
  | 'mixed slick'
  | 'wetness';

/** Narrative line for legwear stain away from crotch (accumulation + rate). */
export function narrateClothStain(opts: {
  where: string;
  score: number;
  rate: WetGrowthRate;
  garmentName?: string;
}): string {
  const accum = clothStainLabel(clothStainFromScore(opts.score));
  if (accum === 'dry') return '';
  const rate = growthRateLabel(opts.rate);
  const g = opts.garmentName ? `${opts.garmentName} ` : '';
  if (opts.rate === 'clearlyEstablished') {
    return `a clearly established ${accum} on the ${g}${opts.where}`;
  }
  return `a ${rate} ${accum} on the ${g}${opts.where}`;
}

/** Narrative line for free-running thigh trail (present tense unless established). */
export function narrateBareThighRun(opts: {
  form: BareSkinForm;
  range: BareSkinRange;
  rate: WetGrowthRate;
  contents: FluidContentsWord;
}): string {
  if (opts.form === 'none' || opts.range === 'none') return '';
  const form = bareSkinFormLabel(opts.form);
  const contents = opts.contents;
  const reach =
    opts.range === 'reachedTheThigh'
      ? 'the thigh'
      : opts.range === 'partwayDownTheThigh'
        ? 'partway down the thigh'
        : opts.range === 'bottomOfTheThigh'
          ? 'to the bottom of the thigh'
          : 'down the calf';

  if (opts.rate === 'clearlyEstablished') {
    return `a clearly established ${form} of ${contents} ${bareSkinRangeLabel(opts.range)}`;
  }

  const pace =
    opts.rate === 'slowlyCreeping'
      ? 'slowly'
      : opts.rate === 'swiftlyBlossoming'
        ? 'swiftly'
        : 'steadily';

  if (opts.form === 'singleBead' && opts.range === 'reachedTheThigh') {
    return `a single bead of ${contents} ${pace} reaching the thigh`;
  }
  if (opts.form === 'singleBead') {
    return `a single bead of ${contents} ${pace} rolling ${reach}`;
  }
  if (opts.range === 'reachedTheThigh') {
    return `a ${form} of ${contents} ${pace} reaching the thigh`;
  }
  return `a ${form} of ${contents} ${pace} running ${reach}`;
}

/**
 * Narrative line for rear / seat runoff while lying or seated.
 * Present tense while growing; established uses static pooled/down phrasing.
 * Anal verge is called out so future anal lubrication can key off the same range.
 */
export function narrateBareSeatRun(opts: {
  form: BareSkinForm;
  range: BareSeatRange;
  rate: WetGrowthRate;
  contents: FluidContentsWord;
}): string {
  if (opts.form === 'none' || opts.range === 'none') return '';
  const form = bareSkinFormLabel(opts.form);
  const contents = opts.contents;

  if (opts.rate === 'clearlyEstablished') {
    return `a clearly established ${form} of ${contents} ${bareSeatRangeEstablishedLabel(opts.range)}`;
  }

  const pace =
    opts.rate === 'slowlyCreeping'
      ? 'slowly'
      : opts.rate === 'swiftlyBlossoming'
        ? 'swiftly'
        : 'steadily';

  switch (opts.range) {
    case 'alongThePerineum':
      return `a ${form} of ${contents} ${pace} tracking along the perineum`;
    case 'atTheAnalVerge':
      return `a ${form} of ${contents} ${pace} wetting the anal verge`;
    case 'atTheCleft':
      return `a ${form} of ${contents} ${pace} pooling at the cleft`;
    case 'downOverTheCheek':
      return `a ${form} of ${contents} ${pace} running down over the cheek`;
    case 'towardTheBed':
      return `a ${form} of ${contents} ${pace} running toward the bed`;
    default:
      return '';
  }
}
