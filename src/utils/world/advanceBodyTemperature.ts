import { BODY_TEMP_TUNING as T } from '../../data/world/bodyTempTuning';
import type { Unit as DetailedUnit, Sex } from '../../types/characters';
import type { WeatherExposure } from './weatherExposure';

export interface BodyTempSnapshot {
  coreTempF: number;
  skinHandsF: number;
  skinFaceF: number;
  heatStress01: number;
}

export interface AdvanceBodyTemperatureOpts {
  sleeping?: boolean;
  /**
   * Extra chill (°F) from wet worn clothing evaporating.
   * Subtracted from felt ambient (helps in heat, hurts in cold).
   */
  evaporativeChillF?: number;
}

export interface AdvanceBodyTemperatureResult {
  unit: DetailedUnit;
  from: BodyTempSnapshot;
  to: BodyTempSnapshot;
  feltAmbientF: number;
  coreTargetF: number;
  evaporativeChillF: number;
  /** Compact Pass Time fragment (empty if negligible change). */
  summary: string;
  /** True when heat stress is high enough that sweat dampens cloth. */
  sweatIntent: boolean;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function approach(value: number, target: number, rate: number, hours: number): number {
  if (!(hours > 0) || rate <= 0) return value;
  return value + (target - value) * (1 - Math.exp(-rate * hours));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Read body-temp fields with defaults (legacy saves omit them). */
export function readBodyTemp(unit: DetailedUnit): BodyTempSnapshot {
  const d = unit.lewdStats.dynamic;
  return {
    coreTempF: typeof d.coreTempF === 'number' ? d.coreTempF : T.normalCoreF,
    skinHandsF:
      typeof d.skinHandsF === 'number' ? d.skinHandsF : T.defaultSkinHandsF,
    skinFaceF: typeof d.skinFaceF === 'number' ? d.skinFaceF : T.defaultSkinFaceF,
    heatStress01:
      typeof d.heatStress01 === 'number'
        ? clamp(d.heatStress01, 0, 1)
        : 0,
  };
}

/**
 * Physique + sex rate multipliers.
 * - Heavier → slower core change (thermal mass)
 * - Taller for weight → more surface → slightly faster
 * - Higher CON → stronger pull back toward normalCoreF, slower drift away
 */
export function bodyTempRateFactors(unit: DetailedUnit): {
  coreRateMult: number;
  skinRateMult: number;
  homeostasisMult: number;
} {
  const w = Math.max(80, unit.weight || T.ref.weightLb);
  const h = Math.max(54, unit.height || T.ref.heightIn);
  const con = clamp(unit.combatStats.base.constitution ?? T.ref.constitution, 1, 20);

  const massInertia = Math.pow(T.ref.weightLb / w, 0.42);
  const surfaceBoost = Math.pow(h / T.ref.heightIn, 0.22);
  const sexKey: Sex = unit.sex === 'F' ? 'F' : 'M';
  const sex = T.sex[sexKey];

  const coreRateMult = clamp(massInertia * surfaceBoost * (1 / sex.coreInertia), 0.55, 1.65);
  const skinRateMult = clamp(surfaceBoost * sex.skinRate, 0.7, 1.5);
  // CON 7 ≈ 1.0; high CON recovers faster / resists extremes a bit more.
  const homeostasisMult = clamp(0.55 + (con / T.ref.constitution) * 0.45, 0.55, 1.45);

  return { coreRateMult, skinRateMult, homeostasisMult };
}

/** Felt ambient after wet chill (°F). */
export function feltAmbientF(exposure: WeatherExposure): number {
  return (
    exposure.effectiveAmbientF - exposure.wetPressure01 * T.wetChillMaxF
  );
}

/** Homeostatic core target under current exposure. */
export function coreTempTargetF(
  felt: number,
  homeostasisMult: number
): number {
  let target = T.normalCoreF;
  if (felt < T.coldStressStartF) {
    const deficit = T.coldStressStartF - felt;
    target -= deficit * T.coldPullPerAmbientF;
  } else if (felt > T.heatStressStartF) {
    const surplus = felt - T.heatStressStartF;
    target += surplus * T.heatPullPerAmbientF;
  }
  // Mild comfort band: nudge back toward normal a touch harder via CON.
  const comfortPull =
    (T.normalCoreF - target) * (1 - 1 / Math.max(1, homeostasisMult)) * 0.35;
  target += comfortPull;
  return clamp(target, T.minCoreF, T.maxCoreF);
}

/** Skin target: tracks felt ambient with an offset toward core warmth. */
function skinTargetF(
  felt: number,
  core: number,
  extremityBias: number
): number {
  // Mix ambient and a soft core-linked floor so hands never equal outdoor air instantly.
  const ambientShare = 0.72 + extremityBias;
  const mixed = felt * ambientShare + core * (1 - ambientShare);
  return clamp(mixed, T.minSkinF, T.maxSkinF);
}

function coreBandLabel(core: number): string {
  const b = T.bands;
  if (core <= b.hypothermic) return 'hypothermic';
  if (core <= b.cold) return 'cold';
  if (core <= b.cool) return 'cool';
  if (core < b.normalLow) return 'slightly cool';
  if (core <= b.normalHigh) return 'normal';
  if (core <= b.warm) return 'warm';
  if (core <= b.hot) return 'hot';
  return 'overheating';
}

function skinTellLabel(hands: number, face: number): string | null {
  if (hands <= 62 || face <= 68) return 'chilled hands / nose';
  if (hands <= 72 || face <= 78) return 'cool extremities';
  if (hands >= 96 || face >= 97) return 'flushed skin';
  return null;
}

/**
 * Advance unit body temperature from weather exposure over `hours`.
 * Mutates only lewdStats.dynamic temp fields.
 */
export function advanceBodyTemperature(
  unit: DetailedUnit,
  hours: number,
  exposure: WeatherExposure,
  opts?: AdvanceBodyTemperatureOpts
): AdvanceBodyTemperatureResult {
  const evaporativeChillF = Math.max(0, opts?.evaporativeChillF ?? 0);
  const from = readBodyTemp(unit);
  if (!(hours > 0)) {
    return {
      unit,
      from,
      to: from,
      feltAmbientF: round1(feltAmbientF(exposure) - evaporativeChillF),
      coreTargetF: from.coreTempF,
      evaporativeChillF: round1(evaporativeChillF),
      summary: '',
      sweatIntent: from.heatStress01 >= 0.25,
    };
  }

  const factors = bodyTempRateFactors(unit);
  const felt = feltAmbientF(exposure) - evaporativeChillF;
  let coreTarget = coreTempTargetF(felt, factors.homeostasisMult);

  // Sleep: slightly lower metabolic hold + shelter already in exposure.
  if (opts?.sleeping) {
    coreTarget = clamp(coreTarget - 0.35, T.minCoreF, T.maxCoreF);
  }

  let coreRate = T.coreApproachPerHour * factors.coreRateMult;
  if (coreTarget < from.coreTempF) {
    // Cooling: wet pressure + low CON make it faster; high CON resists.
    coreRate *=
      (1 + exposure.wetPressure01 * (T.wetCoreCoolMult - 1)) /
      Math.max(0.75, factors.homeostasisMult);
  } else if (coreTarget > from.coreTempF) {
    // Heating: CON helps dump heat a bit (higher homeostasis → faster toward cooler target
    // is already handled; when rising into heat, CON slightly slows feverish climb).
    coreRate *= 0.9 + 0.15 / factors.homeostasisMult;
  }

  const nextCore = clamp(
    approach(from.coreTempF, coreTarget, coreRate, hours),
    T.minCoreF,
    T.maxCoreF
  );

  const handsTarget = skinTargetF(felt, nextCore, 0.08);
  const faceTarget = skinTargetF(felt, nextCore, 0.02);
  const handsRate = T.skinHandsApproachPerHour * factors.skinRateMult;
  const faceRate = T.skinFaceApproachPerHour * factors.skinRateMult;
  const nextHands = clamp(
    approach(from.skinHandsF, handsTarget, handsRate, hours),
    T.minSkinF,
    T.maxSkinF
  );
  const nextFace = clamp(
    approach(from.skinFaceF, faceTarget, faceRate, hours),
    T.minSkinF,
    T.maxSkinF
  );

  // Heat stress — sweat damp on cloth is written by advanceGarmentWetness.
  const hs = T.heatStress;
  let heat = from.heatStress01;
  const ambientHot = Math.max(0, felt - T.heatStressStartF);
  const coreHot = Math.max(0, nextCore - hs.coreStartF);
  const rise =
    (coreHot * 0.55 + ambientHot * hs.ambientRiseScale) * hs.risePerHourAtHot;
  if (rise > 0) {
    heat = approach(heat, 1, rise, hours);
  } else {
    heat = approach(heat, 0, hs.decayPerHour, hours);
  }
  heat = clamp(heat, 0, 1);

  const to: BodyTempSnapshot = {
    coreTempF: round1(nextCore),
    skinHandsF: round1(nextHands),
    skinFaceF: round1(nextFace),
    heatStress01: round3(heat),
  };

  const nextUnit: DetailedUnit = {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: {
        ...unit.lewdStats.dynamic,
        coreTempF: to.coreTempF,
        skinHandsF: to.skinHandsF,
        skinFaceF: to.skinFaceF,
        heatStress01: to.heatStress01,
      },
    },
  };

  const sweatIntent = to.heatStress01 >= 0.25;
  const coreDelta = to.coreTempF - from.coreTempF;
  const notable =
    Math.abs(coreDelta) >= 0.15 ||
    Math.abs(to.skinHandsF - from.skinHandsF) >= 1.5 ||
    Math.abs(to.heatStress01 - from.heatStress01) >= 0.08 ||
    evaporativeChillF >= 0.5;

  let summary = '';
  if (notable) {
    const bits = [
      `core ${from.coreTempF.toFixed(1)}→${to.coreTempF.toFixed(1)}°F (${coreBandLabel(to.coreTempF)})`,
    ];
    const tell = skinTellLabel(to.skinHandsF, to.skinFaceF);
    if (tell) bits.push(tell);
    if (evaporativeChillF >= 0.4) {
      bits.push(`wet-cloth −${evaporativeChillF.toFixed(1)}°F`);
    }
    if (sweatIntent) {
      bits.push(`heat-stress ${(to.heatStress01 * 100).toFixed(0)}%`);
    } else if (to.heatStress01 >= 0.08) {
      bits.push(`heat-stress ${(to.heatStress01 * 100).toFixed(0)}%`);
    }
    summary = bits.join(' · ');
  }

  return {
    unit: nextUnit,
    from,
    to,
    feltAmbientF: round1(felt),
    coreTargetF: round1(coreTarget),
    evaporativeChillF: round1(evaporativeChillF),
    summary,
    sweatIntent,
  };
}

/** UI helper: short comfort label from core + skin. */
export function describeBodyTempComfort(snap: BodyTempSnapshot): string {
  const band = coreBandLabel(snap.coreTempF);
  const tell = skinTellLabel(snap.skinHandsF, snap.skinFaceF);
  if (snap.heatStress01 >= 0.45) {
    return tell ? `${band} · sweating · ${tell}` : `${band} · sweating`;
  }
  if (snap.heatStress01 >= 0.25) {
    return tell ? `${band} · warm / damp · ${tell}` : `${band} · warm / damp`;
  }
  return tell ? `${band} · ${tell}` : band;
}
