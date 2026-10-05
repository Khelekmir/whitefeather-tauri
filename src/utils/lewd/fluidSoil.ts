import type { Unit as DetailedUnit, SpermEntrySite } from '../../types/characters';
import type {
  ClothSoilRegion,
  FluidSoilBag,
  FluidSoilByRegion,
  FluidSoilChannel,
  FluidSoilKind,
  Item,
  ItemSlot,
  MaterialId,
  UnderwearStyle,
} from '../../types/items';
import { getItemTemplate } from '../../data/catalog/itemTemplates';
import { getDetailedItem } from '../../data/starters/combatCastInventory';
import { hormonesForUnit } from './ovulationCycle';
import {
  bodilyStateFromHormones,
  feltWetnessForUnit,
} from './cycleBodilyState';
import type { FluidDischargeEvent, FluidKind } from './fluidDischarge';
import type { EncounterPosture } from './encounterArousal';
import { LEWD_TUNING as T } from './lewdTuning';
import {
  describeUnderwearWetness,
  isFeminineArousalElevated,
  sizeFromWetScore,
  type UnderwearWetnessReport,
  type WetPatchSize,
} from './undergarmentWetnessFlavor';

const SOIL_KINDS: FluidSoilKind[] = [
  'blood',
  'sweat',
  'semen',
  'urine',
  'vaginalDischarge',
  'arousalFluid',
];

/** Soft crotch layers for seepage (inner → outer). Extensible for future deposits. */
export const CROTCH_SEEPAGE_SLOTS: ItemSlot[] = ['underwear', 'leg'];

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

/** Wet load on a garment region (defaults to crotch / legacy soiled). */
export function wetLoadPoints(
  item: Item,
  region: ClothSoilRegion = 'crotch'
): number {
  const bag = normalizeSoilBag(soilBagForRegion(item, region));
  return SOIL_KINDS.reduce((sum, k) => sum + (bag[k].wet ?? 0), 0);
}

/** Total wet+dry intensity for size banding on a region. */
export function regionSoilScore(
  item: Item,
  region: ClothSoilRegion = 'crotch'
): number {
  const bag = normalizeSoilBag(soilBagForRegion(item, region));
  return SOIL_KINDS.reduce((sum, k) => sum + soilIntensity(bag[k]), 0);
}

export function soilBagForRegion(
  item: Item,
  region: ClothSoilRegion
): Partial<FluidSoilBag> | undefined {
  const by = item.lewdStats.soiledByRegion?.[region];
  if (by) return by;
  if (region === 'crotch') return item.lewdStats.soiled;
  return undefined;
}

/**
 * Material + underwear-style soak resilience.
 * Higher capacityMult = holds more before full; higher throughMult = bleeds outward faster.
 */
export function clothSoakProfile(item: Item): {
  capacityMult: number;
  throughMult: number;
} {
  const S = T.cycle.clothSeepage;
  const matId = (item.material ?? 'cloth') as MaterialId;
  const mat = S.material[matId] ?? S.material.cloth;
  let capacityMult = mat.capacityMult;
  let throughMult = mat.throughMult;
  const style = getItemTemplate(item.templateId)?.underwearStyle as
    | UnderwearStyle
    | undefined;
  if (style && S.underwearStyle[style as keyof typeof S.underwearStyle]) {
    const st = S.underwearStyle[style as keyof typeof S.underwearStyle];
    capacityMult *= st.capacityMult;
    throughMult *= st.throughMult;
  }
  return {
    capacityMult: Math.max(0.4, capacityMult),
    throughMult: Math.max(0.1, Math.min(2.2, throughMult)),
  };
}

/** Wet-point soak capacity for a garment region (material-scaled). */
export function soakCapacityPoints(
  item: Item,
  region: ClothSoilRegion = 'crotch'
): number {
  const S = T.cycle.clothSeepage;
  const base =
    item.slot === 'underwear' ? S.underwearCapacity : S.legCapacity;
  // Legwear splits capacity across zones so crotch can't hoard the whole pool.
  let regionShare = 1;
  if (item.slot === 'leg') {
    if (region === 'crotch') regionShare = 0.45;
    else if (region === 'innerThigh') regionShare = 0.4;
    else if (region === 'seat') regionShare = 0.55;
    else if (region === 'hem') regionShare = 0.25;
  }
  return Math.max(
    8,
    Math.round(base * regionShare * clothSoakProfile(item).capacityMult)
  );
}

export function crotchSeepageLayers(unit: DetailedUnit): Item[] {
  const layers: Item[] = [];
  for (const slot of CROTCH_SEEPAGE_SLOTS) {
    const item = getEquippedItem(unit, slot);
    if (item) layers.push(item);
  }
  return layers;
}

/**
 * Write wet soil into a garment region; mirrors crotch → legacy `soiled`.
 * Direct outer deposits (ejaculate on seat/thigh) use this with region ≠ crotch.
 */
export function applyWetSoilToItemRegion(
  item: Item,
  kind: FluidSoilKind,
  amount01: number,
  region: ClothSoilRegion = 'crotch'
): void {
  const prevRegions: FluidSoilByRegion = {
    ...(item.lewdStats.soiledByRegion ?? {}),
  };
  const prevBag = normalizeSoilBag(
    prevRegions[region] ?? (region === 'crotch' ? item.lewdStats.soiled : undefined)
  );
  const nextBag = applyWetSoil(prevBag, kind, amount01);
  prevRegions[region] = nextBag;
  const nextLewd = {
    ...item.lewdStats,
    soiledByRegion: prevRegions,
  };
  if (region === 'crotch') {
    nextLewd.soiled = nextBag;
  }
  item.lewdStats = nextLewd;
}

export interface SeepageLayerResult {
  slot: ItemSlot;
  name: string;
  amount01: number;
  region: ClothSoilRegion;
}

export interface CrotchSeepageResult {
  unit: DetailedUnit;
  layers: SeepageLayerResult[];
  skinAmount01: number;
  /** True when fluid stuck on a layer outside underwear. */
  outerSeep: boolean;
}

export interface CrotchSeepageOpts {
  /** Standing vs seated/lying — routes outer overflow region. */
  posture?: EncounterPosture;
  /**
   * Optional direct outer deposit region (male/female ejaculate on seat/thigh).
   * When set and no underwear path, writes this region on leg/skin.
   */
  preferOuterRegion?: ClothSoilRegion;
}

/** Outer leg region for overflow given posture. */
export function outerOverflowRegion(
  posture: EncounterPosture = 'standing'
): ClothSoilRegion {
  if (posture === 'seated' || posture === 'lying') return 'seat';
  return 'crotch';
}

/**
 * Split a deposit into lateral stick vs through-seep.
 * Saturated regions absorb nothing — excess passes downstream (rate-capped).
 * Coin-sized patches may seep concurrently while still expanding laterally.
 */
function splitLateralAndThrough(
  item: Item,
  flow: number,
  region: ClothSoilRegion
): { stuck: number; through: number; saturated: boolean } {
  const S = T.cycle.clothSeepage;
  const profile = clothSoakProfile(item);
  const capacity = soakCapacityPoints(item, region);
  const load = wetLoadPoints(item, region);
  const room01 = Math.max(0, (capacity - load) / 100);
  const score = regionSoilScore(item, region);

  // Full: stop absorbing; pass flow onward (higher cap so surges aren't erased).
  if (room01 <= 1e-6) {
    return {
      stuck: 0,
      through: Math.min(flow, S.maxThroughWhenSaturated01),
      saturated: true,
    };
  }

  let throughShare = 0;
  if (score >= S.earlySeepFromScore) {
    const span = Math.max(1, capacity - S.earlySeepFromScore);
    const t = Math.max(0, Math.min(1, (score - S.earlySeepFromScore) / span));
    throughShare =
      (S.earlySeepShareMin + (S.throughFraction - S.earlySeepShareMin) * t) *
      profile.throughMult;
  }

  let through = Math.min(flow * throughShare, S.maxThroughPerApply01);
  const lateralBudget = Math.max(0, flow - through);
  const stuck = Math.min(lateralBudget, room01);
  const unabsorbed = Math.max(0, lateralBudget - stuck);
  // No room left for the rest of this deposit — pass fully downstream (rate-capped).
  if (unabsorbed > 1e-6) {
    through += Math.min(
      unabsorbed,
      Math.max(0, S.maxThroughWhenSaturated01 - through)
    );
  }

  return { stuck, through, saturated: false };
}

/** Standing: underwear → leg crotch → leg innerThigh. Seated/lying: → leg seat. */
function regionChainForLayer(
  item: Item,
  posture: EncounterPosture
): ClothSoilRegion[] {
  if (item.slot === 'underwear') return ['crotch'];
  if (posture === 'seated' || posture === 'lying') return ['seat'];
  return ['crotch', 'innerThigh'];
}

/**
 * Shared crotch seepage engine (kind-open).
 * Lateral expand on inner layer + optional concurrent through from ~coin score.
 * Posture routes outer deposit to crotch vs seat. Regions accept direct ejaculate later.
 *
 * Later: anal plug influences anal retention/leak; bare thigh/calf trail (Phase 2).
 */
export function applyCrotchFluidSeepage(
  unit: DetailedUnit,
  kind: FluidSoilKind,
  amount01: number,
  opts?: CrotchSeepageOpts
): CrotchSeepageResult {
  const S = T.cycle.clothSeepage;
  const posture = opts?.posture ?? 'standing';
  let flow = Math.max(0, amount01);
  const layersHit: SeepageLayerResult[] = [];
  let nextUnit = unit;
  let outerSeep = false;

  if (!(flow > 1e-6)) {
    return { unit, layers: [], skinAmount01: 0, outerSeep: false };
  }

  const layers = crotchSeepageLayers(unit);
  if (layers.length === 0) {
    const crotchSoil = applyWetSoil(
      nextUnit.lewdStats.dynamic.crotchSoil,
      kind,
      flow
    );
    return {
      unit: {
        ...nextUnit,
        lewdStats: {
          ...nextUnit.lewdStats,
          dynamic: { ...nextUnit.lewdStats.dynamic, crotchSoil },
        },
      },
      layers: [],
      skinAmount01: flow,
      outerSeep: false,
    };
  }

  for (let i = 0; i < layers.length; i++) {
    if (flow < 1e-6) break;
    const item = layers[i]!;
    const isOuter = item.slot !== 'underwear';
    const regions = regionChainForLayer(item, posture);

    for (const region of regions) {
      if (flow < 1e-6) break;
      const { stuck, through } = splitLateralAndThrough(item, flow, region);
      if (stuck > 1e-6) {
        applyWetSoilToItemRegion(item, kind, stuck, region);
        layersHit.push({
          slot: item.slot,
          name: item.name,
          amount01: stuck,
          region,
        });
        if (isOuter) outerSeep = true;
      }
      flow = through;
    }
  }

  let skinAmount01 = 0;
  if (flow > 1e-6) {
    skinAmount01 = flow * S.skinSmearFraction;
    if (skinAmount01 > 1e-6) {
      const crotchSoil = applyWetSoil(
        nextUnit.lewdStats.dynamic.crotchSoil,
        kind,
        skinAmount01
      );
      nextUnit = {
        ...nextUnit,
        lewdStats: {
          ...nextUnit.lewdStats,
          dynamic: { ...nextUnit.lewdStats.dynamic, crotchSoil },
        },
      };
    }
  }

  return {
    unit: nextUnit,
    layers: layersHit,
    skinAmount01,
    outerSeep,
  };
}

/**
 * Direct deposit onto an outer garment region (e.g. ejaculate on seat / thigh).
 * Does not require underwear overflow — for outer-area male/female emissions.
 */
export function applyDirectGarmentRegionSoil(
  unit: DetailedUnit,
  kind: FluidSoilKind,
  amount01: number,
  region: ClothSoilRegion,
  slot: ItemSlot = 'leg'
): DetailedUnit {
  if (!(amount01 > 1e-6)) return unit;
  const item = getEquippedItem(unit, slot);
  if (item) {
    applyWetSoilToItemRegion(item, kind, amount01, region);
    return unit;
  }
  const crotchSoil = applyWetSoil(
    unit.lewdStats.dynamic.crotchSoil,
    kind,
    amount01
  );
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: { ...unit.lewdStats.dynamic, crotchSoil },
    },
  };
}

/** Direct slot write without seepage (menstrual blood stays underwear-local for now). */
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
  opts?: { encounterArousal?: number; posture?: EncounterPosture }
): DetailedUnit {
  if (!recipientIsTarget || recipient.sex !== 'F') return recipient;
  let unit = recipient;
  const elevated = isFeminineArousalElevated(unit, opts?.encounterArousal);
  const seepOpts = { posture: opts?.posture ?? 'standing' };
  for (const d of discharges) {
    const kind = soilKindFromDischarge(d.kind);
    if (!kind) continue;
    if (d.kind === 'semen' || d.kind === 'preEjaculate') {
      if (d.fromId === recipient.id) continue;
      unit = applyCrotchFluidSeepage(unit, kind, d.volume * 0.85, seepOpts).unit;
      if (elevated) {
        unit = applyCrotchFluidSeepage(
          unit,
          'arousalFluid',
          d.volume * 0.28,
          seepOpts
        ).unit;
      }
    } else if (d.fromId === recipient.id) {
      unit = applyCrotchFluidSeepage(unit, kind, d.volume * 0.55, seepOpts).unit;
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
  const ratePerHour = 0.08;
  return applySoilToEquippedCloth(unit, 'blood', ratePerHour * hours).unit;
}

/**
 * Idle / Pass Time drip from felt wetness (may exceed readiness into oversat).
 * Intensity scales to wetnessCap so oversat drips faster than “just ready.”
 * Guardrail: avg peak+lust near readiness needs ≥~8h to fill underwear capacity.
 */
export function accrueArousalWetSpotDrip(
  unit: DetailedUnit,
  hours: number,
  opts?: {
    encounterArousal?: number;
    desireMood01?: number;
    posture?: EncounterPosture;
  }
): DetailedUnit {
  if (unit.sex !== 'F' || !(hours > 0)) return unit;
  const D = T.cycle.arousalDrip;
  const cap = T.cycle.wetnessCap;
  const wet = feltWetnessForUnit(unit, {
    encounterArousal: opts?.encounterArousal,
    desireMood01: opts?.desireMood01,
  });
  if (!wet) return unit;

  const felt = wet.feltWetness;
  if (felt < D.soilFromWetnessThreshold) return unit;

  const intensity =
    (felt - D.soilFromWetnessThreshold) /
    Math.max(0.01, cap - D.soilFromWetnessThreshold);
  const amount01 = D.amountPerHourAtCap * intensity * hours;
  if (amount01 < 0.002) return unit;
  return applyCrotchFluidSeepage(unit, 'arousalFluid', amount01, {
    posture: opts?.posture ?? 'standing',
  }).unit;
}

const VAGINAL_SITES: SpermEntrySite[] = [
  'vaginaDeep',
  'vaginaShallow',
  'labia',
];

/**
 * Retained semen in tract slowly leaks onto crotch cloth while dressed.
 * Hasty dress without cleaning → underwear fill → possible leg overflow.
 * Anal path uses a higher stub rate; plug influence tabled for later.
 */
export function accrueRetainedSemenLeak(
  unit: DetailedUnit,
  hours: number
): DetailedUnit {
  if (unit.sex !== 'F' || !(hours > 0)) return unit;
  const cohorts = unit.lewdStats.dynamic.spermCohorts;
  if (!cohorts?.length) return unit;
  const S = T.cycle.clothSeepage;

  let vaginalVol = 0;
  let analVol = 0;
  for (const c of cohorts) {
    if (VAGINAL_SITES.includes(c.entrySite)) vaginalVol += c.volume;
    else if (c.entrySite === 'anus') analVol += c.volume;
    // perineum splash is already external — skip tract leak
  }

  let next = unit;
  const vaginalLeak = vaginalVol * S.vaginalSemenLeakPerHour * hours;
  if (vaginalLeak >= 0.002) {
    next = applyCrotchFluidSeepage(next, 'semen', vaginalLeak).unit;
  }
  // Anal retention leak stub (plug / tropes later — rate only for now).
  const analLeak = analVol * S.analSemenLeakPerHour * hours;
  if (analLeak >= 0.002) {
    next = applyCrotchFluidSeepage(next, 'semen', analLeak).unit;
  }
  return next;
}

function dryItemRegions(item: Item, hours: number): void {
  const soiled = item.lewdStats.soiled
    ? drySoilBag(item.lewdStats.soiled, hours)
    : undefined;
  const prev = item.lewdStats.soiledByRegion;
  let soiledByRegion: FluidSoilByRegion | undefined;
  if (prev) {
    soiledByRegion = {};
    for (const key of Object.keys(prev) as ClothSoilRegion[]) {
      soiledByRegion[key] = drySoilBag(prev[key], hours);
    }
  }
  item.lewdStats = {
    ...item.lewdStats,
    ...(soiled ? { soiled } : {}),
    ...(soiledByRegion ? { soiledByRegion } : {}),
  };
  // Keep crotch mirror in sync when regions exist.
  if (soiledByRegion?.crotch) {
    item.lewdStats.soiled = normalizeSoilBag(soiledByRegion.crotch);
  }
}

export function dryUnitAndUnderwearSoil(
  unit: DetailedUnit,
  hours: number
): DetailedUnit {
  if (!(hours > 0)) return unit;
  const crotchSoil = drySoilBag(unit.lewdStats.dynamic.crotchSoil, hours);
  for (const slot of CROTCH_SEEPAGE_SLOTS) {
    const item = getEquippedItem(unit, slot);
    if (item && (item.lewdStats.soiled || item.lewdStats.soiledByRegion)) {
      dryItemRegions(item, hours);
    }
  }
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: { ...unit.lewdStats.dynamic, crotchSoil },
    },
  };
}

/** Clear underwear soil only. */
export function launderUnderwear(unit: DetailedUnit): DetailedUnit {
  const item = getEquippedItem(unit, 'underwear');
  if (item) {
    item.lewdStats = {
      ...item.lewdStats,
      soiled: clearSoilBag(),
      soiledByRegion: undefined,
    };
  }
  return unit;
}

/**
 * Lab instant-clean for all crotch seepage layers + skin.
 * Production: washing is a social task per soiled garment.
 */
export function launderCrotchLayers(unit: DetailedUnit): DetailedUnit {
  for (const slot of CROTCH_SEEPAGE_SLOTS) {
    const item = getEquippedItem(unit, slot);
    if (item) {
      item.lewdStats = {
        ...item.lewdStats,
        soiled: clearSoilBag(),
        soiledByRegion: undefined,
      };
    }
  }
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

export interface RegionWetCue {
  region: ClothSoilRegion;
  size: WetPatchSize;
  score: number;
}

export interface SoilCues {
  soiledPanty: boolean;
  soiledPeriodCloth: boolean;
  visibleResidue: boolean;
  wantsBath: boolean;
  /** Fluid reached leg / outer crotch layer. */
  outerSeep: boolean;
  /** Legwear region patch sizes (crotch / seat / innerThigh). */
  legRegions: RegionWetCue[];
  summary: string;
  /** Quantified crotch dampness + flavor (arousal / semen). */
  wetness: UnderwearWetnessReport;
}

function legRegionCues(leg: Item | undefined): RegionWetCue[] {
  if (!leg) return [];
  const regions: ClothSoilRegion[] = ['crotch', 'seat', 'innerThigh'];
  const out: RegionWetCue[] = [];
  for (const region of regions) {
    const score = regionSoilScore(leg, region);
    const size = sizeFromWetScore(score);
    if (size === 'none') continue;
    out.push({ region, size, score });
  }
  return out;
}

export function deriveSoilCues(
  unit: DetailedUnit,
  opts?: { posture?: EncounterPosture }
): SoilCues {
  const underwear = getEquippedItem(unit, 'underwear');
  const leg = getEquippedItem(unit, 'leg');
  const cloth = normalizeSoilBag(
    underwear ? soilBagForRegion(underwear, 'crotch') : undefined
  );
  const legSoil = normalizeSoilBag(
    leg ? soilBagForRegion(leg, 'crotch') : undefined
  );
  const skin = normalizeSoilBag(unit.lewdStats.dynamic.crotchSoil);
  const wetness = describeUnderwearWetness(unit);
  const legRegions = legRegionCues(leg);

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

  const legWet =
    legSoil.semen.wet +
    legSoil.arousalFluid.wet +
    legSoil.vaginalDischarge.wet +
    legSoil.urine.wet;
  const legScore =
    soilIntensity(legSoil.semen) +
    soilIntensity(legSoil.arousalFluid) +
    soilIntensity(legSoil.vaginalDischarge) +
    soilIntensity(legSoil.urine);
  const outerSeep =
    legRegions.length > 0 || legScore >= 4 || legWet >= 3;

  const soiledPanty = pantySemen + pantyBlood + pantyDischarge >= 12;
  const soiledPeriodCloth = pantyBlood >= 18;
  const visibleResidue = clothDry >= 15 && clothWet < clothDry;
  const wantsBath =
    skinTotal >= 10 ||
    clothWet >= 20 ||
    pantyBlood >= 25 ||
    pantySemen >= 22 ||
    outerSeep;

  const bits: string[] = [];
  if (soiledPeriodCloth) bits.push('period cloth soiled');
  else if (pantyBlood >= 8) {
    bits.push(cloth.blood.dry >= cloth.blood.wet ? 'dried blood on cloth' : 'blood on underwear');
  }
  if (wetness.size !== 'none') {
    bits.push(wetness.label);
  }
  for (const r of legRegions) {
    const where =
      r.region === 'seat'
        ? 'seat'
        : r.region === 'innerThigh'
          ? 'inner thigh'
          : 'crotch';
    bits.push(`${leg?.name ?? 'leg'} ${where} ${r.size}`);
  }
  if (outerSeep && legRegions.length === 0) {
    bits.push(leg ? `seeped through ${leg.name}` : 'outer seep');
  }
  if (opts?.posture && opts.posture !== 'standing') {
    bits.push(opts.posture);
  }
  if (wantsBath) bits.push('wants a bath');

  return {
    soiledPanty,
    soiledPeriodCloth,
    visibleResidue,
    wantsBath,
    outerSeep,
    legRegions,
    summary: bits.length ? bits.join(' · ') : 'clean',
    wetness,
  };
}

export interface AdvanceFluidSoilOpts {
  /** Ephemeral encounter arousal 0–100 (Lewd Lab idle). */
  encounterArousal?: number;
  /** Reserved mild desire / mood 0–1 (arousal-wetness hook). */
  desireMood01?: number;
  /** Standing vs seated/lying cloth routing. */
  posture?: EncounterPosture;
}

/** Pass Time: dry soil + menses + arousal drip + retained semen leak. */
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
    desireMood01: opts?.desireMood01,
    posture: opts?.posture,
  });
  next = accrueRetainedSemenLeak(next, hours);
  return next;
}
