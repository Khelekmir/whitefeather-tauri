import type {
  ImplantationKind,
  OvumState,
  OvumStation,
  PregnancyState,
  SpermCohort,
  SpermEntrySite,
  Unit as DetailedUnit,
} from '../../types/characters';
import { bodilyStateFromHormones } from './cycleBodilyState';
import type { FluidDischargeEvent } from './fluidDischarge';
import {
  fertileCrest01,
  hormonesForUnit,
  ovulationReleaseHour,
  wrapCycleHour,
} from './ovulationCycle';

let idSeq = 0;
function nextId(prefix: string): string {
  idSeq += 1;
  return `${prefix}_${idSeq}_${Date.now().toString(36)}`;
}

export const CONCEPTION_TUNING = {
  ovumViabilityHours: 18,
  tubeProximalHours: 6,
  tubeDistalHours: 18,
  spermMotilityHours: {
    vaginaDeep: 48,
    vaginaShallow: 42,
    labia: 36,
    perineum: 30,
    anus: 24,
  } as Record<SpermEntrySite, number>,
  ascentStart: {
    // Deep deposit can reach the meeting zone immediately.
    vaginaDeep: 0.86,
    vaginaShallow: 0.28,
    labia: 0.06,
    perineum: 0.04,
    anus: 0,
  } as Record<SpermEntrySite, number>,
  ascentPerHour: {
    vaginaDeep: 0.08,
    vaginaShallow: 0.12,
    labia: 0.07,
    perineum: 0.06,
    anus: 0.02,
  } as Record<SpermEntrySite, number>,
  /** Volume multiplier when creating a tract cohort from a discharge. */
  entryVolumeMult: {
    vaginaDeep: 1,
    vaginaShallow: 0.85,
    labia: 0.45,
    perineum: 0.35,
    anus: 0.55,
  } as Record<SpermEntrySite, number>,
  meetAscentMin: 0.82,
  baseConceiveChance: 0.55,
  stationFertMult: {
    tubeProximal: 0.7,
    tubeDistal: 1,
    uterine: 0.12,
  } as Record<OvumStation, number>,
  ectopicChance: {
    tubeProximal: 0.28,
    tubeDistal: 0.09,
    uterine: 0.015,
  } as Record<OvumStation, number>,
  /** Anal cohort leak → perineum each hour. */
  analLeakPerHour: 0.22,
  analLeakVolumeKeep: 0.55,
} as const;

function stationForAge(ageHours: number): OvumStation {
  if (ageHours < CONCEPTION_TUNING.tubeProximalHours) return 'tubeProximal';
  if (ageHours < CONCEPTION_TUNING.tubeDistalHours) return 'tubeDistal';
  return 'uterine';
}

/**
 * True when Pass Time crosses ovum release — aligned with fertile-crest peak
 * (`ovulationReleaseHour` = day 14 on a 28-day cycle, scaled by length).
 */
export function crossedOvulationRelease(
  prevHour: number,
  nextHour: number,
  lengthDays: number
): boolean {
  const release = ovulationReleaseHour(lengthDays);
  if (nextHour >= prevHour) {
    return prevHour < release && nextHour >= release;
  }
  // Wrapped past cycle end.
  return prevHour < release || nextHour >= release;
}

export function spawnOvum(): OvumState {
  return {
    id: nextId('ovum'),
    ageHours: 0,
    station: 'tubeProximal',
    viabilityHoursLeft: CONCEPTION_TUNING.ovumViabilityHours,
  };
}

export function advanceOvum(
  ovum: OvumState | null | undefined,
  hours: number
): OvumState | null {
  if (!ovum || !(hours > 0)) return ovum ?? null;
  const ageHours = ovum.ageHours + hours;
  const viabilityHoursLeft = ovum.viabilityHoursLeft - hours;
  if (viabilityHoursLeft <= 0) return null;
  return {
    ...ovum,
    ageHours,
    viabilityHoursLeft,
    station: stationForAge(ageHours),
  };
}

export function inferSpermEntrySite(targetParts: string[]): SpermEntrySite {
  const parts = targetParts.map((p) => p.toLowerCase());
  if (parts.some((p) => p === 'vaginadeep')) return 'vaginaDeep';
  if (parts.some((p) => p === 'vaginashallow' || p.startsWith('vagina'))) {
    return 'vaginaShallow';
  }
  if (parts.some((p) => p.includes('anus') || p.includes('rectum'))) {
    return 'anus';
  }
  if (parts.some((p) => p.includes('perin'))) return 'perineum';
  if (
    parts.some(
      (p) =>
        p.includes('labia') || p.includes('clitoris') || p.includes('mons')
    )
  ) {
    return 'labia';
  }
  return 'labia';
}

export function createSpermCohort(
  fromId: string,
  entrySite: SpermEntrySite,
  volume: number
): SpermCohort {
  const T = CONCEPTION_TUNING;
  return {
    id: nextId('sperm'),
    fromId,
    entrySite,
    volume: Math.max(0.05, volume * T.entryVolumeMult[entrySite]),
    motilityHoursLeft: T.spermMotilityHours[entrySite],
    ascent01: T.ascentStart[entrySite],
  };
}

function advanceOneCohort(c: SpermCohort, hours: number): SpermCohort | SpermCohort[] | null {
  if (!(hours > 0)) return c;
  const T = CONCEPTION_TUNING;
  let motilityHoursLeft = c.motilityHoursLeft - hours;
  if (motilityHoursLeft <= 0) return null;

  // Anal leak path → perineum splash entry
  if (c.entrySite === 'anus') {
    const leakChance = 1 - Math.exp(-T.analLeakPerHour * hours);
    if (Math.random() < leakChance) {
      const leaked: SpermCohort = {
        ...c,
        id: nextId('sperm'),
        entrySite: 'perineum',
        volume: c.volume * T.analLeakVolumeKeep,
        ascent01: Math.max(c.ascent01, T.ascentStart.perineum),
        motilityHoursLeft,
      };
      const remainingVol = c.volume * (1 - T.analLeakVolumeKeep);
      if (remainingVol < 0.08) return leaked;
      return [
        {
          ...c,
          volume: remainingVol,
          motilityHoursLeft,
          ascent01: Math.min(1, c.ascent01 + T.ascentPerHour.anus * hours),
        },
        leaked,
      ];
    }
  }

  const ascent01 = Math.min(
    1,
    c.ascent01 + T.ascentPerHour[c.entrySite] * hours
  );
  return { ...c, motilityHoursLeft, ascent01 };
}

export function advanceSpermCohorts(
  cohorts: SpermCohort[] | undefined,
  hours: number
): SpermCohort[] {
  if (!cohorts?.length || !(hours > 0)) return cohorts ?? [];
  const next: SpermCohort[] = [];
  for (const c of cohorts) {
    const r = advanceOneCohort(c, hours);
    if (!r) continue;
    if (Array.isArray(r)) next.push(...r);
    else next.push(r);
  }
  return next;
}

export interface ConceptionAttempt {
  conceived: boolean;
  pregnancy?: PregnancyState;
  chance: number;
  note: string;
}

export function tryConceive(input: {
  unit: DetailedUnit;
  ovum: OvumState;
  cohorts: SpermCohort[];
  rng?: () => number;
}): ConceptionAttempt {
  const rng = input.rng ?? Math.random;
  const T = CONCEPTION_TUNING;
  const length = input.unit.lewdStats.static.ovulationCycleLength || 28;
  const h = hormonesForUnit(input.unit);
  const crest = h ? fertileCrest01(h, length) : 0.5;
  const body = h ? bodilyStateFromHormones(h, length) : null;
  const mucusBonus =
    body?.mucusKind === 'eggWhite'
      ? 1.15
      : body?.mucusKind === 'sticky'
        ? 1.0
        : 0.85;

  const contenders = input.cohorts.filter(
    (c) => c.ascent01 >= T.meetAscentMin && c.volume >= 0.08
  );
  if (!contenders.length) {
    return {
      conceived: false,
      chance: 0,
      note: 'No sperm cohort has reached the tube meeting zone yet.',
    };
  }

  const stationMult = T.stationFertMult[input.ovum.station];
  // Pick strongest cohort
  const best = [...contenders].sort(
    (a, b) => b.volume * b.ascent01 - a.volume * a.ascent01
  )[0]!;

  const chance = Math.max(
    0,
    Math.min(
      0.92,
      T.baseConceiveChance *
        stationMult *
        mucusBonus *
        (0.55 + 0.45 * crest) *
        Math.min(1.2, best.volume) *
        (0.7 + 0.3 * best.ascent01)
    )
  );

  if (rng() >= chance) {
    return {
      conceived: false,
      chance,
      note: `Conception check failed (p=${chance.toFixed(2)}) at ${input.ovum.station}.`,
    };
  }

  const ectopicRoll = rng();
  const ectopicP = T.ectopicChance[input.ovum.station];
  const implantation: ImplantationKind =
    ectopicRoll < ectopicP ? 'ectopic' : 'intrauterine';

  const pregnancy: PregnancyState = {
    conceivedAtCycleHour: input.unit.lewdStats.dynamic.ovulationCycleCurrent ?? 0,
    gestationDay: 0,
    fatherId: best.fromId,
    conceptionSite: best.entrySite,
    fertStation: input.ovum.station,
    implantation,
    conceptus: {
      id: nextId('conceptus'),
      stage: 'zygote',
      health: 100,
    },
    status: 'ongoing',
  };

  return {
    conceived: true,
    pregnancy,
    chance,
    note: `Conceived (${implantation}) from ${best.entrySite} meet at ${input.ovum.station} (p=${chance.toFixed(2)}).`,
  };
}

export interface ReproductionAdvanceResult {
  unit: DetailedUnit;
  ovumSpawned: boolean;
  ovumExpired: boolean;
  conceived: boolean;
  conceptionNote: string | null;
  pregnancy?: PregnancyState;
}

/**
 * Pass Time: spawn/advance ovum, advance sperm, attempt conception, tick gestation.
 * When pregnant (ongoing), cycle clock is left alone by caller.
 */
export function advanceReproduction(
  unit: DetailedUnit,
  hours: number,
  opts?: { prevCycleHour?: number; rng?: () => number }
): ReproductionAdvanceResult {
  if (unit.sex !== 'F' || !(hours > 0)) {
    return {
      unit,
      ovumSpawned: false,
      ovumExpired: false,
      conceived: false,
      conceptionNote: null,
    };
  }

  const dyn = unit.lewdStats.dynamic;
  const pregnancy = dyn.pregnancy;

  // Ongoing pregnancy: advance gestation only (miscarriage/trauma later).
  if (pregnancy && pregnancy.status === 'ongoing') {
    const gestationDay = pregnancy.gestationDay + hours / 24;
    let stage = pregnancy.conceptus.stage;
    if (gestationDay >= 70) stage = 'fetus';
    else if (gestationDay >= 14) stage = 'embryo';
    const nextPreg: PregnancyState = {
      ...pregnancy,
      gestationDay,
      conceptus: { ...pregnancy.conceptus, stage },
    };
    return {
      unit: {
        ...unit,
        lewdStats: {
          ...unit.lewdStats,
          dynamic: {
            ...dyn,
            pregnancy: nextPreg,
            ovum: null,
            spermCohorts: [],
          },
        },
      },
      ovumSpawned: false,
      ovumExpired: false,
      conceived: false,
      conceptionNote: null,
      pregnancy: nextPreg,
    };
  }

  const length = unit.lewdStats.static.ovulationCycleLength || 28;
  const prevHour =
    opts?.prevCycleHour ?? wrapCycleHour((dyn.ovulationCycleCurrent ?? 0) - hours, length);
  const curHour = dyn.ovulationCycleCurrent ?? 0;

  let ovum = dyn.ovum ?? null;
  let ovumSpawned = false;
  let ovumExpired = false;

  if (!ovum && crossedOvulationRelease(prevHour, curHour, length)) {
    ovum = spawnOvum();
    ovumSpawned = true;
  }

  const beforeViability = ovum?.viabilityHoursLeft;
  ovum = advanceOvum(ovum, hours);
  if (beforeViability != null && beforeViability > 0 && !ovum) ovumExpired = true;

  let cohorts = advanceSpermCohorts(dyn.spermCohorts, hours);

  let conceived = false;
  let conceptionNote: string | null = null;
  let nextPregnancy = pregnancy ?? null;

  if (ovum && cohorts.length && !nextPregnancy) {
    const attempt = tryConceive({
      unit: {
        ...unit,
        lewdStats: {
          ...unit.lewdStats,
          dynamic: { ...dyn, ovum, spermCohorts: cohorts },
        },
      },
      ovum,
      cohorts,
      rng: opts?.rng,
    });
    conceptionNote = attempt.note;
    if (attempt.conceived && attempt.pregnancy) {
      conceived = true;
      nextPregnancy = attempt.pregnancy;
      ovum = null;
      cohorts = [];
    }
  }

  return {
    unit: {
      ...unit,
      lewdStats: {
        ...unit.lewdStats,
        dynamic: {
          ...dyn,
          ovum,
          spermCohorts: cohorts,
          pregnancy: nextPregnancy,
        },
      },
    },
    ovumSpawned,
    ovumExpired,
    conceived,
    conceptionNote,
    pregnancy: nextPregnancy ?? undefined,
  };
}

/** After a lewd beat: turn semen discharges into sperm cohorts. */
export function applySemenDischargesToReproduction(
  recipient: DetailedUnit,
  discharges: FluidDischargeEvent[],
  targetParts: string[]
): DetailedUnit {
  if (recipient.sex !== 'F') return recipient;
  if (recipient.lewdStats.dynamic.pregnancy?.status === 'ongoing') {
    return recipient;
  }
  const inferred = inferSpermEntrySite(targetParts);
  const cohorts = [...(recipient.lewdStats.dynamic.spermCohorts ?? [])];
  for (const d of discharges) {
    if (d.kind !== 'semen' && d.kind !== 'preEjaculate') continue;
    if (d.fromSex !== 'M') continue;
    const site = d.site ?? inferred;
    cohorts.push(createSpermCohort(d.fromId, site, d.volume));
  }
  if (cohorts.length === (recipient.lewdStats.dynamic.spermCohorts ?? []).length) {
    return recipient;
  }
  return {
    ...recipient,
    lewdStats: {
      ...recipient.lewdStats,
      dynamic: {
        ...recipient.lewdStats.dynamic,
        spermCohorts: cohorts,
      },
    },
  };
}

export function describeReproduction(unit: DetailedUnit): string {
  if (unit.sex !== 'F') return 'n/a';
  const dyn = unit.lewdStats.dynamic;
  if (dyn.pregnancy?.status === 'ongoing') {
    const p = dyn.pregnancy;
    return `pregnant d${p.gestationDay.toFixed(1)} · ${p.implantation} · ${p.conceptus.stage} hp${p.conceptus.health}`;
  }
  const bits: string[] = [];
  if (dyn.ovum) {
    bits.push(
      `ovum ${dyn.ovum.station} · life ${dyn.ovum.viabilityHoursLeft.toFixed(1)}h`
    );
  }
  const n = dyn.spermCohorts?.length ?? 0;
  if (n) {
    const best = Math.max(...dyn.spermCohorts!.map((c) => c.ascent01));
    bits.push(`${n} sperm cohort(s) · best ascent ${(best * 100).toFixed(0)}%`);
  }
  return bits.length ? bits.join(' · ') : 'no ovum / no cohorts';
}
