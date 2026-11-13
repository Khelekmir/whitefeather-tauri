/**
 * Thin fluid-sample scaffold.
 *
 * Cloth / orifice soil stay anonymous intensity meters.
 * Identity + expandable properties live on:
 *   - EncounterFluidDeposit (ephemeral, discarded with the encounter)
 *   - FluidSample (persistent after harvest / collect)
 *
 * Consumables push UnitSubstanceTrace onto the donor; stampFluidProperties
 * copies them onto emitted or collected fluid at transfer fractions.
 */

import type { Unit as DetailedUnit } from '../../types/characters';
import type {
  EncounterFluidDeposit,
  FluidDepositLocus,
  FluidDonorSex,
  FluidProperty,
  FluidPropertyId,
  FluidSample,
  FluidSampleKind,
  UnitSubstanceTrace,
} from '../../types/fluids';
import type { FluidDischargeEvent, FluidKind } from './fluidDischarge';

export type {
  EncounterFluidDeposit,
  FluidDepositLocus,
  FluidDonorSex,
  FluidProperty,
  FluidPropertyId,
  FluidSample,
  FluidSampleKind,
  UnitSubstanceTrace,
} from '../../types/fluids';

/** Default fraction of a substance trace that appears in each fluid kind. */
export const DEFAULT_FLUID_TRANSFER: Record<FluidSampleKind, number> = {
  blood: 1,
  urine: 0.85,
  sweat: 0.55,
  semen: 0.4,
  preEjaculate: 0.25,
  femaleEjaculate: 0.4,
  vaginalSecretion: 0.35,
  saliva: 0.2,
  slugMucin: 0.5,
  other: 0.35,
};

let sampleSeq = 0;
function nextFluidId(prefix: string): string {
  sampleSeq += 1;
  return `${prefix}_${sampleSeq}_${Date.now().toString(36)}`;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Map climax / secretion discharge kinds onto sample kinds. */
export function sampleKindFromDischarge(kind: FluidKind): FluidSampleKind | null {
  switch (kind) {
    case 'semen':
      return 'semen';
    case 'preEjaculate':
      return 'preEjaculate';
    case 'femaleEjaculate':
      return 'femaleEjaculate';
    case 'lubricationSurge':
      return 'vaginalSecretion';
    default:
      return null;
  }
}

/**
 * Guess deposit locus from channel targets / sperm entry site.
 * Oral climax → mouth; genital/anal deposit sites → matching orifice; else cloth.
 */
export function inferFluidDepositLocus(
  kind: FluidSampleKind,
  targetParts: string[] = [],
  site?: string
): FluidDepositLocus {
  const parts = targetParts.map((p) => p.toLowerCase());
  if (
    parts.some(
      (p) =>
        p.includes('mouth') ||
        p.includes('lips') ||
        p.includes('tongue') ||
        p.includes('throat')
    )
  ) {
    return 'mouth';
  }
  const siteKey = (site ?? '').toLowerCase();
  if (siteKey.includes('anus') || siteKey.includes('rectum')) return 'anus';
  if (siteKey.includes('vagina')) return 'vagina';
  if (parts.some((p) => p.includes('anus') || p.includes('rectum'))) return 'anus';
  if (parts.some((p) => p.includes('vagina'))) return 'vagina';
  if (
    kind === 'femaleEjaculate' ||
    kind === 'vaginalSecretion'
  ) {
    return 'vagina';
  }
  if (kind === 'saliva') return 'mouth';
  if (kind === 'sweat' || kind === 'blood') return 'skin';
  if (kind === 'semen' || kind === 'preEjaculate') return 'cloth';
  return 'unknown';
}

function transferForTrace(
  trace: UnitSubstanceTrace,
  kind: FluidSampleKind
): number {
  if (trace.fluidTransfer && kind in trace.fluidTransfer) {
    return Math.max(0, trace.fluidTransfer[kind] ?? 0);
  }
  return DEFAULT_FLUID_TRANSFER[kind] ?? 0.35;
}

/**
 * Stamp expandable properties from the donor's active substance traces.
 * Optional BAC bridge seeds an 'ethanol' property so consumable→fluid is demoable
 * before a full substance-trace writer exists for drinks.
 */
export function stampFluidProperties(
  unit: DetailedUnit,
  kind: FluidSampleKind
): FluidProperty[] {
  const out: FluidProperty[] = [];
  const seen = new Set<string>();

  const traces = unit.lewdStats.dynamic.substanceTraces ?? [];
  for (const trace of traces) {
    const transfer = transferForTrace(trace, kind);
    if (transfer <= 1e-6 || trace.potency01 <= 1e-6) continue;
    const potency01 = round3(Math.max(0, trace.potency01) * transfer);
    if (potency01 <= 1e-6) continue;
    const key = `${trace.id}::${trace.sourceId ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: trace.id,
      potency01,
      sourceId: trace.sourceId,
      label: trace.label ?? trace.id,
    });
  }

  // Thin consumable bridge: blood alcohol → ethanol on transferable fluids.
  const bac = unit.socialStats?.dynamic?.BAC ?? 0;
  if (bac > 0.01 && !seen.has('ethanol::bac')) {
    const transfer = DEFAULT_FLUID_TRANSFER[kind] ?? 0;
    if (transfer > 0) {
      // 0.08% BAC ≈ potency 1 before transfer.
      const potency01 = round3(clamp01(bac / 0.08) * transfer);
      if (potency01 > 1e-6) {
        out.push({
          id: 'ethanol',
          potency01,
          sourceId: 'bac',
          label: 'ethanol',
        });
      }
    }
  }

  return out;
}

/** Push or refresh a substance trace on the unit (elixir / berry / medicine). */
export function applySubstanceTrace(
  unit: DetailedUnit,
  trace: UnitSubstanceTrace
): DetailedUnit {
  const prev = unit.lewdStats.dynamic.substanceTraces ?? [];
  const without = prev.filter(
    (t) => !(t.id === trace.id && (t.sourceId ?? '') === (trace.sourceId ?? ''))
  );
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: {
        ...unit.lewdStats.dynamic,
        substanceTraces: [...without, { ...trace, potency01: Math.max(0, trace.potency01) }],
      },
    },
  };
}

export function clearSubstanceTrace(
  unit: DetailedUnit,
  id: FluidPropertyId,
  sourceId?: string
): DetailedUnit {
  const prev = unit.lewdStats.dynamic.substanceTraces ?? [];
  const next = prev.filter((t) => {
    if (t.id !== id) return true;
    if (sourceId == null) return false;
    return (t.sourceId ?? '') !== sourceId;
  });
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: {
        ...unit.lewdStats.dynamic,
        substanceTraces: next,
      },
    },
  };
}

export function createEncounterFluidDeposit(input: {
  kind: FluidSampleKind;
  fromId: string;
  fromSex?: FluidDonorSex;
  volume01: number;
  locus?: FluidDepositLocus;
  properties?: FluidProperty[];
  unit?: DetailedUnit;
  targetParts?: string[];
  site?: string;
}): EncounterFluidDeposit {
  const locus =
    input.locus ??
    inferFluidDepositLocus(input.kind, input.targetParts, input.site);
  const properties =
    input.properties ??
    (input.unit ? stampFluidProperties(input.unit, input.kind) : []);
  return {
    id: nextFluidId('fdep'),
    kind: input.kind,
    fromId: input.fromId,
    fromSex: input.fromSex,
    volume01: Math.max(0, input.volume01),
    locus,
    properties,
  };
}

/** Append deposits; returns a new array. */
export function appendEncounterFluidDeposits(
  existing: EncounterFluidDeposit[] | undefined,
  added: EncounterFluidDeposit[]
): EncounterFluidDeposit[] {
  if (!added.length) return existing ? [...existing] : [];
  return [...(existing ?? []), ...added];
}

/**
 * Turn beat discharges into ephemeral deposits (identity + stamped properties).
 * Skips tiny lubrication dribbles; climax / meaningful volumes land.
 */
export function depositsFromDischarges(input: {
  discharges: FluidDischargeEvent[];
  unitsById: Record<string, DetailedUnit>;
  targetParts?: string[];
  /** Skip lubricationSurge below this volume (after soil pre-scale). */
  minVolume01?: number;
}): EncounterFluidDeposit[] {
  const minVol = input.minVolume01 ?? 0.08;
  const out: EncounterFluidDeposit[] = [];
  for (const d of input.discharges) {
    const kind = sampleKindFromDischarge(d.kind);
    if (!kind) continue;
    // Ambient slick soil events are anonymous cloth intensity — skip unless large.
    if (d.kind === 'lubricationSurge' && d.volume < minVol) continue;
    const unit = input.unitsById[d.fromId];
    out.push(
      createEncounterFluidDeposit({
        kind,
        fromId: d.fromId,
        fromSex: d.fromSex,
        volume01: d.volume,
        unit,
        targetParts: input.targetParts,
        site: d.site,
        properties: unit ? stampFluidProperties(unit, kind) : [],
      })
    );
  }
  return out;
}

/** Explicit collect during a social/combat/lab event — stamps from the unit now. */
export function collectFluidFromUnit(
  unit: DetailedUnit,
  kind: FluidSampleKind,
  volume01: number,
  opts?: { collectedAt?: number; label?: string }
): { unit: DetailedUnit; sample: FluidSample } {
  const sample: FluidSample = {
    id: nextFluidId('fsamp'),
    kind,
    fromId: unit.id,
    fromSex: unit.sex,
    volume01: Math.max(0, volume01),
    properties: stampFluidProperties(unit, kind),
    collectedAt: opts?.collectedAt,
    label: opts?.label,
  };
  return { unit: addFluidSample(unit, sample), sample };
}

/** Lift an encounter deposit into a persistent sample; removes it from the encounter list. */
export function harvestEncounterDeposit(
  deposits: EncounterFluidDeposit[] | undefined,
  depositId: string,
  opts?: { collectedAt?: number; label?: string; intoUnit?: DetailedUnit }
): {
  deposits: EncounterFluidDeposit[];
  sample: FluidSample | null;
  unit?: DetailedUnit;
} {
  const list = deposits ?? [];
  const idx = list.findIndex((d) => d.id === depositId);
  if (idx < 0) {
    return { deposits: [...list], sample: null, unit: opts?.intoUnit };
  }
  const dep = list[idx]!;
  const nextDeposits = [...list.slice(0, idx), ...list.slice(idx + 1)];
  const sample: FluidSample = {
    id: nextFluidId('fsamp'),
    kind: dep.kind,
    fromId: dep.fromId,
    fromSex: dep.fromSex,
    volume01: dep.volume01,
    properties: [...dep.properties],
    collectedAt: opts?.collectedAt,
    label: opts?.label,
  };
  const unit = opts?.intoUnit
    ? addFluidSample(opts.intoUnit, sample)
    : undefined;
  return { deposits: nextDeposits, sample, unit };
}

export function addFluidSample(
  unit: DetailedUnit,
  sample: FluidSample
): DetailedUnit {
  const prev = unit.lewdStats.dynamic.fluidSamples ?? [];
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: {
        ...unit.lewdStats.dynamic,
        fluidSamples: [...prev, sample],
      },
    },
  };
}

export function removeFluidSample(
  unit: DetailedUnit,
  sampleId: string
): { unit: DetailedUnit; sample: FluidSample | null } {
  const prev = unit.lewdStats.dynamic.fluidSamples ?? [];
  const idx = prev.findIndex((s) => s.id === sampleId);
  if (idx < 0) return { unit, sample: null };
  const sample = prev[idx]!;
  return {
    unit: {
      ...unit,
      lewdStats: {
        ...unit.lewdStats,
        dynamic: {
          ...unit.lewdStats.dynamic,
          fluidSamples: [...prev.slice(0, idx), ...prev.slice(idx + 1)],
        },
      },
    },
    sample,
  };
}

/** Sum potency for a property id across a sample (mix-ready helper). */
export function samplePropertyPotency(
  sample: { properties: FluidProperty[] },
  propertyId: FluidPropertyId
): number {
  return sample.properties
    .filter((p) => p.id === propertyId)
    .reduce((sum, p) => sum + p.potency01, 0);
}
