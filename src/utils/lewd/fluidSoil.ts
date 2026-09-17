import type { Unit as DetailedUnit } from '../../types/characters';
import type {
  FluidSoilBag,
  FluidSoilChannel,
  FluidSoilKind,
  Item,
  ItemSlot,
} from '../../types/items';
import { getDetailedItem } from '../../data/starters/combatCastInventory';
import { hormonesForUnit } from './ovulationCycle';
import { bodilyStateFromHormones } from './cycleBodilyState';
import type { FluidDischargeEvent, FluidKind } from './fluidDischarge';
import { LEWD_TUNING as T } from './lewdTuning';
import {
  describeUnderwearWetness,
  isFeminineArousalElevated,
  type UnderwearWetnessReport,
} from './undergarmentWetnessFlavor';

const SOIL_KINDS: FluidSoilKind[] = [
  'blood',
  'sweat',
  'semen',
  'urine',
  'vaginalDischarge',
  'arousalFluid',
];

export const EMPTY_SOIL_CHANNEL: FluidSoilChannel = { wet: 0, dry: 0 };

export function emptySoilBag(): FluidSoilBag {
  return {
    blood: { ...EMPTY_SOIL_CHANNEL },
    sweat: { ...EMPTY_SOIL_CHANNEL },
    semen: { ...EMPTY_SOIL_CHANNEL },
    urine: { ...EMPTY_SOIL_CHANNEL },
    vaginalDischarge: { ...EMPTY_SOIL_CHANNEL },
    arousalFluid: { ...EMPTY_SOIL_CHANNEL },
  };
}

export function normalizeSoilBag(
  partial?: Partial<FluidSoilBag> | null
): FluidSoilBag {
  const base = emptySoilBag();
  if (!partial) return base;
  for (const kind of SOIL_KINDS) {
    const row = partial[kind];
    if (!row) continue;
    base[kind] = {
      wet: clamp100(row.wet ?? 0),
      dry: clamp100(row.dry ?? 0),
    };
  }
  return base;
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function addWet(channel: FluidSoilChannel, amount: number): FluidSoilChannel {
  return {
    wet: clamp100(channel.wet + Math.max(0, amount)),
    dry: channel.dry,
  };
}

/** Total stain intensity (wet + dry), capped. */
export function soilIntensity(channel: FluidSoilChannel): number {
  return clamp100(channel.wet + channel.dry * 0.85);
}

export function bagIntensity(bag: Partial<FluidSoilBag> | undefined, kind: FluidSoilKind): number {
  const row = bag?.[kind];
  if (!row) return 0;
  return soilIntensity({ wet: row.wet ?? 0, dry: row.dry ?? 0 });
}

export function totalSoilScore(bag: Partial<FluidSoilBag> | undefined): number {
  if (!bag) return 0;
  return SOIL_KINDS.reduce((sum, k) => sum + bagIntensity(bag, k), 0);
}

/** Map discharge kinds → soil channels. */
export function soilKindFromDischarge(kind: FluidKind): FluidSoilKind | null {
  switch (kind) {
    case 'semen':
    case 'preEjaculate':
      return 'semen';
    case 'femaleEjaculate':
      return 'vaginalDischarge';
    case 'lubricationSurge':
      return 'arousalFluid';
    default:
      return null;
  }
}

/**
 * Apply wet soil to a bag. Architecture accepts any garment slot later.
 */
export function applyWetSoil(
  bag: Partial<FluidSoilBag> | undefined,
  kind: FluidSoilKind,
  amount: number
): FluidSoilBag {
  const next = normalizeSoilBag(bag);
  next[kind] = addWet(next[kind], amount * 100);
  return next;
}

/** Evaporate wet → dry; slow fade of dry only when nearly dry-wet. */
export function drySoilBag(
  bag: Partial<FluidSoilBag> | undefined,
  hours: number
): FluidSoilBag {
  const next = normalizeSoilBag(bag);
  if (!(hours > 0)) return next;
  const evaporateRate = 0.35; // fraction of wet→dry per hour
  const dryFadeRate = 0.02; // residue fades slowly
  for (const kind of SOIL_KINDS) {
    const { wet, dry } = next[kind];
    const moved = wet * (1 - Math.exp(-evaporateRate * hours));
    let newWet = clamp100(wet - moved);
    let newDry = clamp100(dry + moved * 0.9);
    if (newWet < 4) {
      newDry = clamp100(newDry * Math.exp(-dryFadeRate * hours));
    }
    next[kind] = { wet: newWet, dry: newDry };
  }
  return next;
}

export function clearSoilBag(): FluidSoilBag {
  return emptySoilBag();
}

/**
 * Prefer underwear for lewd writers.
 * Combat bleed soil uses fighter `itemsById` via `bleedClothSoil.ts` (any covering layer).
 */
export function getEquippedItem(
  unit: DetailedUnit,
  slot: ItemSlot = 'underwear'
): Item | undefined {
  const id = unit.equipment?.[slot];
  if (!id) return undefined;
  return getDetailedItem(id);
}

export function applySoilToEquippedCloth(
  unit: DetailedUnit,
  kind: FluidSoilKind,
  amount01: number,
  slot: ItemSlot = 'underwear'
): { unit: DetailedUnit; item: Item | null } {
  const item = getEquippedItem(unit, slot);
  if (item) {
    const soiled = applyWetSoil(item.lewdStats.soiled, kind, amount01);
    item.lewdStats = { ...item.lewdStats, soiled };
    // Also light skin transfer
    const crotchSoil = applyWetSoil(
      unit.lewdStats.dynamic.crotchSoil,
      kind,
      amount01 * 0.25
    );
    return {
      unit: {
        ...unit,
        lewdStats: {
          ...unit.lewdStats,
          dynamic: { ...unit.lewdStats.dynamic, crotchSoil },
        },
      },
      item,
    };
  }
  const crotchSoil = applyWetSoil(
    unit.lewdStats.dynamic.crotchSoil,
    kind,
    amount01
  );
  return {
    unit: {
      ...unit,
      lewdStats: {
        ...unit.lewdStats,
        dynamic: { ...unit.lewdStats.dynamic, crotchSoil },
      },
    },
    item: null,
  };
}

export function applyDischargesToRecipientSoil(
  recipient: DetailedUnit,
  discharges: FluidDischargeEvent[],
  recipientIsTarget: boolean,
  opts?: { encounterArousal?: number }
): DetailedUnit {
  if (!recipientIsTarget || recipient.sex !== 'F') return recipient;
  let unit = recipient;
  const elevated = isFeminineArousalElevated(unit, opts?.encounterArousal);
  for (const d of discharges) {
    // Semen from a partner soils her; her own fluids soil her cloth too.
    const kind = soilKindFromDischarge(d.kind);
    if (!kind) continue;
    if (d.kind === 'semen' || d.kind === 'preEjaculate') {
      if (d.fromId === recipient.id) continue; // no self-semen
      const applied = applySoilToEquippedCloth(unit, kind, d.volume * 0.85);
      unit = applied.unit;
      // Elevated: seed rarely lands on a dry body — blend feminine slick.
      if (elevated) {
        const blend = applySoilToEquippedCloth(
          unit,
          'arousalFluid',
          d.volume * 0.28
        );
        unit = blend.unit;
      }
    } else if (d.fromId === recipient.id) {
      const applied = applySoilToEquippedCloth(unit, kind, d.volume * 0.55);
      unit = applied.unit;
    }
  }
  return unit;
}

/** Menstrual blood accrual while mucus is bloody / phase menstrual. */
export function accrueMenstrualBlood(
  unit: DetailedUnit,
  hours: number
): DetailedUnit {
  if (unit.sex !== 'F' || !(hours > 0)) return unit;
  const h = hormonesForUnit(unit);
  if (!h) return unit;
  const body = bodilyStateFromHormones(
    h,
    unit.lewdStats.static.ovulationCycleLength || 28
  );
  if (body.mucusKind !== 'bloody' && h.phase !== 'Menstrual') return unit;
  const ratePerHour = 0.08; // → ~8 wet points / hour on 0–100 scale via applyWetSoil *100
  return applySoilToEquippedCloth(unit, 'blood', ratePerHour * hours).unit;
}

/**
 * Idle / Pass Time drip: high lust / cycle wetness / encounter arousal
 * leaves an arousalFluid wet spot without genital play.
 */
export function accrueArousalWetSpotDrip(
  unit: DetailedUnit,
  hours: number,
  opts?: { encounterArousal?: number }
): DetailedUnit {
  if (unit.sex !== 'F' || !(hours > 0)) return unit;
  const D = T.cycle.arousalDrip;
  const lust01 = Math.max(0, Math.min(1, (unit.lewdStats.dynamic.lust ?? 0) / 100));
  const h = hormonesForUnit(unit);
  const body = h
    ? bodilyStateFromHormones(
        h,
        unit.lewdStats.static.ovulationCycleLength || 28
      )
    : null;
  const cycleWet = body?.wetness01 ?? 0;
  const enc01 =
    opts?.encounterArousal != null
      ? Math.max(0, Math.min(1, opts.encounterArousal / 100))
      : 0;

  const drive = Math.max(
    0,
    Math.min(
      1,
      lust01 * D.lustWeight +
        cycleWet * D.cycleWetWeight +
        enc01 * D.encounterArousalWeight
    )
  );
  if (drive < D.driveThreshold) return unit;

  const intensity =
    (drive - D.driveThreshold) / Math.max(0.01, 1 - D.driveThreshold);
  const amount01 =
    D.amountPerHourAtFullDrive * intensity * hours * (0.65 + 0.5 * cycleWet);
  if (amount01 < 0.002) return unit;
  return applySoilToEquippedCloth(unit, 'arousalFluid', amount01).unit;
}

export function dryUnitAndUnderwearSoil(
  unit: DetailedUnit,
  hours: number
): DetailedUnit {
  if (!(hours > 0)) return unit;
  const crotchSoil = drySoilBag(unit.lewdStats.dynamic.crotchSoil, hours);
  const item = getEquippedItem(unit, 'underwear');
  if (item?.lewdStats.soiled) {
    item.lewdStats = {
      ...item.lewdStats,
      soiled: drySoilBag(item.lewdStats.soiled, hours),
    };
  }
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: { ...unit.lewdStats.dynamic, crotchSoil },
    },
  };
}

export function launderUnderwear(unit: DetailedUnit): DetailedUnit {
  const item = getEquippedItem(unit, 'underwear');
  if (item) {
    item.lewdStats = { ...item.lewdStats, soiled: clearSoilBag() };
  }
  return unit;
}

export function batheClearSkinSoil(unit: DetailedUnit): DetailedUnit {
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: {
        ...unit.lewdStats.dynamic,
        crotchSoil: clearSoilBag(),
      },
    },
  };
}

export interface SoilCues {
  soiledPanty: boolean;
  soiledPeriodCloth: boolean;
  visibleResidue: boolean;
  wantsBath: boolean;
  summary: string;
  /** Quantified crotch dampness + flavor (arousal / semen). */
  wetness: UnderwearWetnessReport;
}

export function deriveSoilCues(unit: DetailedUnit): SoilCues {
  const underwear = getEquippedItem(unit, 'underwear');
  const cloth = normalizeSoilBag(underwear?.lewdStats.soiled);
  const skin = normalizeSoilBag(unit.lewdStats.dynamic.crotchSoil);
  const wetness = describeUnderwearWetness(unit);

  const pantySemen = soilIntensity(cloth.semen);
  const pantyBlood = soilIntensity(cloth.blood);
  const pantyDischarge =
    soilIntensity(cloth.vaginalDischarge) + soilIntensity(cloth.arousalFluid);
  const skinTotal = totalSoilScore(skin);
  const clothWet =
    cloth.semen.wet +
    cloth.blood.wet +
    cloth.vaginalDischarge.wet +
    cloth.arousalFluid.wet;
  const clothDry =
    cloth.semen.dry +
    cloth.blood.dry +
    cloth.vaginalDischarge.dry +
    cloth.arousalFluid.dry;

  const soiledPanty = pantySemen + pantyBlood + pantyDischarge >= 12;
  const soiledPeriodCloth = pantyBlood >= 18;
  const visibleResidue = clothDry >= 15 && clothWet < clothDry;
  const wantsBath =
    skinTotal >= 10 || clothWet >= 20 || pantyBlood >= 25 || pantySemen >= 22;

  const bits: string[] = [];
  if (soiledPeriodCloth) bits.push('period cloth soiled');
  else if (pantyBlood >= 8) {
    bits.push(cloth.blood.dry >= cloth.blood.wet ? 'dried blood on cloth' : 'blood on underwear');
  }
  if (wetness.size !== 'none') {
    bits.push(wetness.label);
  }
  if (wantsBath) bits.push('wants a bath');

  return {
    soiledPanty,
    soiledPeriodCloth,
    visibleResidue,
    wantsBath,
    summary: bits.length ? bits.join(' · ') : 'clean',
    wetness,
  };
}

export interface AdvanceFluidSoilOpts {
  /** Ephemeral encounter arousal 0–100 (Lewd Lab idle). */
  encounterArousal?: number;
}

/** Pass Time physiology companion: dry soil + menses blood + arousal drip. */
export function advanceFluidSoil(
  unit: DetailedUnit,
  hours: number,
  opts?: AdvanceFluidSoilOpts
): DetailedUnit {
  if (!(hours > 0)) return unit;
  let next = dryUnitAndUnderwearSoil(unit, hours);
  next = accrueMenstrualBlood(next, hours);
  next = accrueArousalWetSpotDrip(next, hours, {
    encounterArousal: opts?.encounterArousal,
  });
  return next;
}
