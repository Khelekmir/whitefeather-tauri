import type { Unit as DetailedUnit } from '../../types/characters';

/** Menstrual-cycle phase (scaled to character cycle length). */
export type CyclePhase = 'Menstrual' | 'Follicular' | 'Ovulation' | 'Luteal';

/**
 * Hormone ratios relative to menstrual nadir (= 1).
 * Ported from Coding_Notes/utilsLewd_old/CalcHormones.js (Gaussian peaks).
 */
export interface HormoneSnapshot {
  estrogen: number;
  testosterone: number;
  progesterone: number;
  /** Fractional day within the cycle (0 … lengthDays). */
  day: number;
  /** Hours since cycle start (0 … lengthDays*24). */
  hour: number;
  phase: CyclePhase;
  description: string;
}

const PHASE_BLURBS: Record<CyclePhase, string> = {
  Menstrual:
    'Libido is often lowest during the menstrual phase, when estrogen and testosterone sit near nadir.',
  Follicular:
    'Libido rises in the follicular phase as estrogen climbs — mood, energy, and arousal warm up.',
  Ovulation:
    'Libido peaks around ovulation with estrogen and testosterone surges; receptivity and drive run high.',
  Luteal:
    'After ovulation, progesterone dominates — libido usually softens; mood can swing (PMS lean).',
};

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/** Total hours in a cycle of `lengthDays`. */
export function cycleTotalHours(lengthDays: number): number {
  return Math.max(1, lengthDays) * 24;
}

/**
 * Wrap cycle hour into [0, totalHours).
 * `ovulationCycleCurrent` is stored as **hours** since menses start (not day index).
 */
export function wrapCycleHour(hour: number, lengthDays: number): number {
  const total = cycleTotalHours(lengthDays);
  return ((hour % total) + total) % total;
}

export function advanceCycleHour(
  currentHour: number,
  lengthDays: number,
  hours: number
): number {
  return wrapCycleHour(currentHour + hours, lengthDays);
}

export function phaseBoundsHours(lengthDays: number): {
  menstrualEnd: number;
  follicularEnd: number;
  ovulationEnd: number;
} {
  const scale = lengthDays / 28;
  return {
    menstrualEnd: Math.round(5 * scale * 24),
    follicularEnd: Math.round(11 * scale * 24),
    ovulationEnd: Math.round(15 * scale * 24),
  };
}

export function phaseAtHour(hour: number, lengthDays: number): CyclePhase {
  const h = wrapCycleHour(hour, lengthDays);
  const b = phaseBoundsHours(lengthDays);
  if (h <= b.menstrualEnd) return 'Menstrual';
  if (h <= b.follicularEnd) return 'Follicular';
  if (h <= b.ovulationEnd) return 'Ovulation';
  return 'Luteal';
}

/**
 * Compute E / T / P ratios + phase for a cycle position.
 * @param hour hours since cycle start
 * @param lengthDays ovulationCycleLength
 */
export function calcHormones(hour: number, lengthDays: number): HormoneSnapshot {
  const length = Math.max(1, lengthDays);
  const h = wrapCycleHour(hour, length);
  const day = h / 24;
  const scale = length / 28;
  const phase = phaseAtHour(h, length);

  // Estrogen — peri-ovulatory peak + smaller mid-luteal bump
  const centerE1 = 13 * scale;
  const centerE2 = 22 * scale;
  const sigma1 = day <= centerE1 ? 4 * scale : 1.5 * scale;
  const sigma2 = day <= centerE2 ? 4 * scale : 2.5 * scale;
  const termE1 =
    19 * Math.exp(-Math.pow(day - centerE1, 2) / (2 * Math.pow(sigma1, 2)));
  const termE2 =
    9 * Math.exp(-Math.pow(day - centerE2, 2) / (2 * Math.pow(sigma2, 2)));
  const estrogen = round3(1 + termE1 + termE2);

  // Testosterone — ovulation-centered bump
  const centerT = 14 * scale;
  const sigmaT = 4 * scale;
  const termT =
    1.8 * Math.exp(-Math.pow(day - centerT, 2) / (2 * Math.pow(sigmaT, 2)));
  const testosterone = round3(1 + termT);

  // Progesterone — luteal peak
  const centerP = 21 * scale;
  const sigmaP = day <= centerP ? 3 * scale : 4 * scale;
  const termP =
    24 * Math.exp(-Math.pow(day - centerP, 2) / (2 * Math.pow(sigmaP, 2)));
  const progesterone = round3(1 + termP);

  return {
    estrogen,
    testosterone,
    progesterone,
    day: round3(day),
    hour: round3(h),
    phase,
    description: PHASE_BLURBS[phase],
  };
}

/**
 * Scale a hormone curve's excursion above nadir (=1) by a character mult.
 * Mult 1.10 → +10% peak height; menstrual floor stays ~1.
 */
export function applyHormoneSwing(value: number, mult: number | undefined): number {
  const m = mult == null || !(mult > 0) ? 1 : mult;
  return round3(1 + (Math.max(0, value) - 1) * m);
}

export type HormoneSwing = {
  estrogen?: number;
  testosterone?: number;
  progesterone?: number;
};

/** Apply optional per-character swing to a raw calcHormones snapshot. */
export function withHormoneSwing(
  raw: HormoneSnapshot,
  swing?: HormoneSwing | null
): HormoneSnapshot {
  if (!swing) return raw;
  return {
    ...raw,
    estrogen: applyHormoneSwing(raw.estrogen, swing.estrogen),
    testosterone: applyHormoneSwing(raw.testosterone, swing.testosterone),
    progesterone: applyHormoneSwing(raw.progesterone, swing.progesterone),
  };
}

/** Null for non-cycling (male) cast; snapshot for females (with hormoneSwing). */
export function hormonesForUnit(
  unit: Pick<DetailedUnit, 'sex' | 'lewdStats'>
): HormoneSnapshot | null {
  if (unit.sex !== 'F') return null;
  return withHormoneSwing(
    calcHormones(
      unit.lewdStats.dynamic.ovulationCycleCurrent ?? 0,
      unit.lewdStats.static.ovulationCycleLength || 28
    ),
    unit.lewdStats.static.hormoneSwing
  );
}

/** Phase table lust multiplier (coarse). */
export function lustModFromPhase(phase: CyclePhase): number {
  switch (phase) {
    case 'Menstrual':
      return 0.72;
    case 'Follicular':
      return 1.02;
    case 'Ovulation':
      return 1.28;
    case 'Luteal':
      // Lower so high-P luteal stacks harder with hormone damp.
      return 0.78;
  }
}

/**
 * Fine lust mod from hormone ratios (blended with phase table).
 * Lane: progesterone lowers lust setpoint; mild E support; T stays off
 * (T lowers arousal gates, not standing lust).
 * E/P use ln — both peak far above 1 (E~20, P~25).
 */
export function lustModFromHormones(h: HormoneSnapshot): number {
  const phaseMod = lustModFromPhase(h.phase);
  const lnE = Math.log(Math.max(1, h.estrogen));
  const lnP = Math.log(Math.max(1, h.progesterone));
  const hormoneMod = 0.9 + 0.04 * lnE - 0.16 * lnP;
  const blended = phaseMod * 0.55 + hormoneMod * 0.45;
  // Floor 0.48 so stacked luteal (low E / high P / low T elsewhere) can bite.
  return Math.max(0.48, Math.min(1.45, blended));
}

/** Raw appetite (0–100) from static libido alone — before cycle / temperament. */
export function libidoBaseAppetite(libido: number): number {
  const lib = Math.max(1, Math.min(10, libido));
  return Math.min(100, lib * 8.5 + Math.pow(lib, 1.35) * 1.8);
}

/** Standing lust target (0–100) from static libido × cycle hormones. */
export function cycleLustTarget(
  libido: number,
  h: HormoneSnapshot
): number {
  return clamp100(libidoBaseAppetite(libido) * lustModFromHormones(h));
}

/** Small durable-pressure nudges by phase (points toward which meters lean). */
export function cyclePressureBias(phase: CyclePhase): {
  stress: number;
  energy: number;
  shame: number;
} {
  switch (phase) {
    case 'Menstrual':
      return { stress: 6, energy: -8, shame: 2 };
    case 'Follicular':
      return { stress: -3, energy: 5, shame: -2 };
    case 'Ovulation':
      return { stress: -4, energy: 4, shame: -3 };
    case 'Luteal':
      return { stress: 8, energy: -5, shame: 4 };
  }
}

/**
 * Advance female cycle clock by `hours`. Lust is owned by `advanceStandingLust`
 * (Option A: libido×cycle setpoint, temperament rates/expression).
 * No-op for males (call advanceStandingLust separately).
 */
export function advanceFemalePhysiology(
  unit: DetailedUnit,
  hours: number
): {
  unit: DetailedUnit;
  hormones: HormoneSnapshot | null;
  lustFrom: number;
  lustTo: number;
} {
  const lustFrom = unit.lewdStats.dynamic.lust ?? 0;
  if (!(hours > 0) || unit.sex !== 'F') {
    return {
      unit,
      hormones: hormonesForUnit(unit),
      lustFrom,
      lustTo: lustFrom,
    };
  }

  const length = unit.lewdStats.static.ovulationCycleLength || 28;
  const prevHour = unit.lewdStats.dynamic.ovulationCycleCurrent ?? 0;
  const pregnant = unit.lewdStats.dynamic.pregnancy?.status === 'ongoing';
  // Pregnant: freeze the menstrual clock (gestation advances in conception.ts).
  const nextHour = pregnant
    ? prevHour
    : advanceCycleHour(prevHour, length, hours);
  const hormones = withHormoneSwing(
    calcHormones(nextHour, length),
    unit.lewdStats.static.hormoneSwing
  );

  const next: DetailedUnit = {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: {
        ...unit.lewdStats.dynamic,
        ovulationCycleCurrent: nextHour,
      },
    },
  };

  return { unit: next, hormones, lustFrom, lustTo: lustFrom };
}

/** Scale factor vs a 28-day reference cycle. */
export function cycleLengthScale(lengthDays: number): number {
  return Math.max(1, lengthDays) / 28;
}

/**
 * Peak-fertility / ovulation day (fractional), scaled to character cycle length.
 * Shared by fertile crest, mucus peak, and ovum release.
 */
export function ovulationPeakDay(lengthDays: number): number {
  return 14 * cycleLengthScale(lengthDays);
}

/** Cycle hour when the ovum is released (aligned with crest peak). */
export function ovulationReleaseHour(lengthDays: number): number {
  return ovulationPeakDay(lengthDays) * 24;
}

/** Fertile-window helper for impregnation UI / gates. */
export function isInFertileWindow(h: HormoneSnapshot, lengthDays: number): boolean {
  return fertileCrest01(h, lengthDays) >= 0.35;
}

/**
 * Smooth 0–1 fertile crest (sperm lead-in + short post-ovulation tail).
 * Peaks at `ovulationPeakDay` (14 on a 28-day cycle, scaled otherwise).
 */
export function fertileCrest01(h: HormoneSnapshot, lengthDays: number): number {
  const scale = cycleLengthScale(lengthDays);
  const ovDay = ovulationPeakDay(lengthDays);
  const leadIn = 4.5 * scale;
  const tail = 1.6 * scale;
  const d = h.day - ovDay;
  let raw = 0;
  if (d <= 0) {
    raw = 1 - Math.min(1, -d / Math.max(0.01, leadIn));
  } else {
    raw = 1 - Math.min(1, d / Math.max(0.01, tail));
  }
  // Smoothstep for a rounded crest rather than a linear tent.
  const x = Math.max(0, Math.min(1, raw));
  return x * x * (3 - 2 * x);
}

export function formatCycleLabel(h: HormoneSnapshot, lengthDays: number): string {
  const dayNum = Math.floor(h.day) + 1;
  return `${h.phase} · day ${dayNum}/${lengthDays}`;
}
