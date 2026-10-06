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
import {
  bareSeatRangeFromScore,
  bareSeatRangeLabel,
  bareSkinFormFromScore,
  bareSkinFormLabel,
  bareSkinRangeLabel,
  bareThighRangeFromRegions,
  growthRateFromDelta,
  growthRateLabel,
  legRegionWetLabel,
  narrateBareSeatRun,
  narrateBareThighRun,
  narrateClothStain,
  seatTrailWetsAnalVerge,
  skinRegionWetLabel,
  type FluidContentsWord,
  type SkinFilmFeel,
  type WetGrowthRate,
} from './fluidWetnessLabels';
import {
  addOrificeSlickLayer,
  advanceOrificeSlickLayers,
  describeOrificeSlick,
  lubricantKindFromSoilKind,
  type OrificeSlickById,
  type OrificeSlickReport,
} from './orificeSlick';
import { accrueLustSecretionTrickle } from './vaginalSecretion';

const SOIL_KINDS: FluidSoilKind[] = [
  'blood',
  'sweat',
  'semen',
  'urine',
  'vaginalDischarge',
  'arousalFluid',
];

/** Soft crotch layers for seepage (inner → outer). Extensible for future deposits. */
/** Core crotch soak slots. Shirt dresses (garmentLength) join when reclined — see crotchSeepageLayers. */
export const CROTCH_SEEPAGE_SLOTS: ItemSlot[] = ['underwear', 'leg'];

/**
 * Trousers/hose hug the crotch; dresses/skirts with garmentLength do not.
 * Slip-skirt underwear styles also skip crotch hug (seat-first when reclined).
 */
export function garmentHugsCrotch(item: Item): boolean {
  const tpl = getItemTemplate(item.templateId);
  if (!tpl) return item.slot === 'underwear' || item.slot === 'leg';
  if (tpl.garmentLength) return false;
  const style = tpl.underwearStyle;
  if (style === 'longSlipSkirt' || style === 'shortSlipSkirt') return false;
  if (item.slot === 'leg' || item.slot === 'underwear') return true;
  return false;
}

function isRearPosture(posture: EncounterPosture): boolean {
  return (
    posture === 'seated' || posture === 'lying' || posture === 'sideLying'
  );
}

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

/**
 * Underwear → leg pants, plus shirt-slot dresses when reclined (seat soil).
 * Standing short/long dresses are omitted so panty overflow can run on bare thighs.
 */
export function crotchSeepageLayers(
  unit: DetailedUnit,
  posture: EncounterPosture = 'standing'
): Item[] {
  const layers: Item[] = [];
  for (const slot of CROTCH_SEEPAGE_SLOTS) {
    const item = getEquippedItem(unit, slot);
    if (item) layers.push(item);
  }
  if (isRearPosture(posture)) {
    const shirt = getEquippedItem(unit, 'shirt');
    if (shirt) {
      const tpl = getItemTemplate(shirt.templateId);
      if (tpl?.garmentLength) layers.push(shirt);
    }
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

export interface CrotchSeepageOpts {
  /** Routes cloth overflow + skin drip direction. */
  posture?: EncounterPosture;
  /**
   * Optional direct outer deposit region (male/female ejaculate on seat/thigh).
   * When set and no underwear path, writes this region on leg/skin.
   */
  preferOuterRegion?: ClothSoilRegion;
  /**
   * Partner unit for mounted/cowgirl overflow (pants / crotch cloth).
   * When omitted, partner share is still computed and returned as partnerDrip01.
   */
  partner?: DetailedUnit;
}

/** Outer leg region for overflow given posture. */
export function outerOverflowRegion(
  posture: EncounterPosture = 'standing'
): ClothSoilRegion {
  if (
    posture === 'seated' ||
    posture === 'lying' ||
    posture === 'sideLying'
  ) {
    return 'seat';
  }
  return 'crotch';
}

export type SkinDripRegion = 'crotch' | 'thighInner' | 'calf' | 'seat';

const SKIN_DRIP_ORDER: SkinDripRegion[] = [
  'crotch',
  'thighInner',
  'calf',
  'seat',
];

/** Cloth soil region → co-located skin film region. */
function clothRegionToSkin(region: ClothSoilRegion): SkinDripRegion | null {
  if (region === 'crotch') return 'crotch';
  if (region === 'seat') return 'seat';
  if (region === 'innerThigh') return 'thighInner';
  if (region === 'hem') return 'calf';
  return null;
}

/** Posture → bare-skin runoff chain (uncovered only). */
function skinRunChain(posture: EncounterPosture): SkinDripRegion[] {
  if (posture === 'seated' || posture === 'lying') return ['crotch', 'seat'];
  if (posture === 'sideLying') return ['crotch', 'seat', 'thighInner'];
  if (posture === 'handsKnees') return ['crotch', 'thighInner']; // knees on a surface
  return ['crotch', 'thighInner', 'calf']; // standing | mounted
}

function clothSnapKey(slot: ItemSlot, region: ClothSoilRegion): string {
  return `cloth:${slot}:${region}`;
}

function skinSnapKey(region: SkinDripRegion): string {
  return `skin:${region}`;
}

function recordSoilGrowth(
  unit: DetailedUnit,
  key: string,
  prevScore: number,
  nextScore: number,
  deposit01?: number
): DetailedUnit {
  const rate = growthRateFromDelta(prevScore, nextScore, { deposit01 });
  const snap = { ...(unit.lewdStats.dynamic.soilScoreSnap ?? {}) };
  const rates = { ...(unit.lewdStats.dynamic.soilGrowthRate ?? {}) };
  snap[key] = nextScore;
  rates[key] = rate;
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: {
        ...unit.lewdStats.dynamic,
        soilScoreSnap: snap,
        soilGrowthRate: rates,
      },
    },
  };
}

function growthRateForKey(
  unit: DetailedUnit,
  key: string
): WetGrowthRate {
  return unit.lewdStats.dynamic.soilGrowthRate?.[key] ?? 'clearlyEstablished';
}

function fluidContentsWord(unit: DetailedUnit): FluidContentsWord {
  const w = describeUnderwearWetness(unit);
  if (w.contents === 'mixed') return 'mixed slick';
  if (w.contents === 'semenDominant') return 'semen';
  if (w.contents === 'arousalOnly') return 'arousal fluid';
  // Skin-only path: peek skin bags
  const skin = normalizeSoilBag(unit.lewdStats.dynamic.crotchSoil);
  const semen = soilIntensity(skin.semen);
  const arousal =
    soilIntensity(skin.arousalFluid) + soilIntensity(skin.vaginalDischarge) * 0.55;
  if (semen >= 3.5 && arousal >= 4.5) return 'mixed slick';
  if (semen >= 3.5) return 'semen';
  if (arousal >= 4.5) return 'arousal fluid';
  return 'wetness';
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

/**
 * Cloth region chain on a garment for this posture.
 * - Pants (hug crotch): lying/seated crotch → seat; standing crotch → innerThigh.
 * - Dress/skirt (garmentLength, no crotch hug): reclined seat only; standing unused here.
 * - Panties (hug): reclined crotch → seat; standing crotch.
 * - Slip-skirt underwear: reclined seat(-first); standing crotch light panel.
 */
function regionChainForLayer(
  item: Item,
  posture: EncounterPosture
): ClothSoilRegion[] {
  const hugs = garmentHugsCrotch(item);
  if (isRearPosture(posture)) {
    if (hugs) {
      return posture === 'sideLying'
        ? ['crotch', 'seat', 'innerThigh']
        : ['crotch', 'seat'];
    }
    return posture === 'sideLying' ? ['seat', 'innerThigh'] : ['seat'];
  }
  // standing | handsKnees | mounted
  if (item.slot === 'underwear') return ['crotch'];
  if (!hugs) return ['hem'];
  return ['crotch', 'innerThigh'];
}

function getSkinRegionBag(
  unit: DetailedUnit,
  region: SkinDripRegion
): FluidSoilBag {
  const map = unit.lewdStats.dynamic.skinFluidByRegion;
  if (map?.[region]) return normalizeSoilBag(map[region]);
  if (region === 'crotch' && unit.lewdStats.dynamic.crotchSoil) {
    return normalizeSoilBag(unit.lewdStats.dynamic.crotchSoil);
  }
  return emptySoilBag();
}

function getSkinRegionFeel(
  unit: DetailedUnit,
  region: SkinDripRegion
): SkinFilmFeel {
  return unit.lewdStats.dynamic.skinFilmFeelByRegion?.[region] ?? 'running';
}

function setSkinRegionBag(
  unit: DetailedUnit,
  region: SkinDripRegion,
  bag: FluidSoilBag,
  feel?: SkinFilmFeel
): DetailedUnit {
  const prev = { ...(unit.lewdStats.dynamic.skinFluidByRegion ?? {}) };
  prev[region] = bag;
  const feelMap = { ...(unit.lewdStats.dynamic.skinFilmFeelByRegion ?? {}) };
  if (feel) {
    // Tacky wins over running when both contact the same region (cloth wick / undress).
    if (feel === 'tacky' || feelMap[region] !== 'tacky') {
      feelMap[region] = feel;
    }
  }
  const dynamic = {
    ...unit.lewdStats.dynamic,
    skinFluidByRegion: prev,
    skinFilmFeelByRegion: feelMap,
  };
  // Keep legacy crotchSoil mirrored.
  if (region === 'crotch') {
    dynamic.crotchSoil = bag;
  }
  return {
    ...unit,
    lewdStats: { ...unit.lewdStats, dynamic },
  };
}

/**
 * Contact-wick: dampen skin only where cloth just absorbed fluid.
 * Result is tacky/smeared — does not run further under the garment.
 */
export function applyClothContactWick(
  unit: DetailedUnit,
  kind: FluidSoilKind,
  clothRegion: ClothSoilRegion,
  stuck01: number
): DetailedUnit {
  const share = T.cycle.clothSeepage.skinDrip.clothWickToSkinShare;
  const amount01 = stuck01 * share;
  if (!(amount01 > 1e-6)) return unit;
  const skinRegion = clothRegionToSkin(clothRegion);
  if (!skinRegion) return unit;
  const Sk = T.cycle.clothSeepage.skinDrip;
  const bag = getSkinRegionBag(unit, skinRegion);
  const prevScore = skinFilmWetPoints(bag);
  const room01 = Math.max(0, (Sk.filmCapacity - prevScore) / 100);
  const stick = Math.min(amount01, room01);
  if (!(stick > 1e-6)) return unit;
  let next = setSkinRegionBag(
    unit,
    skinRegion,
    applyWetSoil(bag, kind, stick),
    'tacky'
  );
  return recordSoilGrowth(
    next,
    skinSnapKey(skinRegion),
    prevScore,
    skinFilmWetPoints(getSkinRegionBag(next, skinRegion)),
    stick
  );
}

function skinFilmWetPoints(bag: FluidSoilBag): number {
  return SOIL_KINDS.reduce((sum, k) => sum + (bag[k].wet ?? 0), 0);
}

function getAnalVergeBag(unit: DetailedUnit): FluidSoilBag {
  return normalizeSoilBag(unit.lewdStats.dynamic.analVergeWet);
}

function setAnalVergeBag(unit: DetailedUnit, bag: FluidSoilBag): DetailedUnit {
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: {
        ...unit.lewdStats.dynamic,
        analVergeWet: bag,
      },
    },
  };
}

function setOrificeSlick(
  unit: DetailedUnit,
  slick: OrificeSlickById
): DetailedUnit {
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: {
        ...unit.lewdStats.dynamic,
        orificeSlick: slick,
      },
    },
  };
}

/** Deposit verge-dwell soil into anus orificeSlick layers. */
function writeAnusSlickFromVergeDwell(
  unit: DetailedUnit,
  kind: FluidSoilKind,
  stuck01: number
): DetailedUnit {
  const lubeKind = lubricantKindFromSoilKind(kind);
  if (!lubeKind || !(stuck01 > 1e-6)) return unit;
  const prev = unit.lewdStats.dynamic.orificeSlick ?? {};
  const anus = addOrificeSlickLayer(prev.anus, lubeKind, stuck01);
  return setOrificeSlick(unit, { ...prev, anus });
}

/** Idle evaporate for all orifice slick layers. */
export function advanceOrificeSlick(
  unit: DetailedUnit,
  hours: number
): DetailedUnit {
  if (!(hours > 0)) return unit;
  const prev = unit.lewdStats.dynamic.orificeSlick;
  if (!prev) return unit;
  const next: OrificeSlickById = {};
  let any = false;
  for (const orifice of ['vagina', 'anus', 'mouth'] as const) {
    const layers = advanceOrificeSlickLayers(prev[orifice], hours);
    if (layers.length) {
      next[orifice] = layers;
      any = true;
    }
  }
  return setOrificeSlick(unit, any ? next : {});
}

/** Wet points currently held at the anal verge pool. */
export function analVergeWetPoints(unit: DetailedUnit): number {
  return skinFilmWetPoints(getAnalVergeBag(unit));
}

export interface AnalVergeDwellResult {
  unit: DetailedUnit;
  /** amount01 that stuck in the verge pool. */
  stuck01: number;
  /** amount01 shed onto seat film from a full verge. */
  overspillToSeat01: number;
  /** amount01 that left the body when seat film was also full (toward the bed). */
  drippedOff01: number;
}

/**
 * Capture a lasting anal-verge pool from seat-trail fluid.
 * Survives runoff past the verge. When the pool is full, rejected dwell
 * bleeds onto seat film; if seat is also full, the rest drips toward the bed.
 */
export function applyAnalVergeDwell(
  unit: DetailedUnit,
  kind: FluidSoilKind,
  seatArrival01: number
): AnalVergeDwellResult {
  const Sk = T.cycle.clothSeepage.skinDrip;
  const amount01 = seatArrival01 * Sk.vergeDwellShare;
  const empty: AnalVergeDwellResult = {
    unit,
    stuck01: 0,
    overspillToSeat01: 0,
    drippedOff01: 0,
  };
  if (!(amount01 > 1e-6)) return empty;

  const bag = getAnalVergeBag(unit);
  const load = skinFilmWetPoints(bag);
  const room01 = Math.max(0, (Sk.vergeCapacity - load) / 100);
  const stick = Math.min(amount01, room01);
  let overspill01 = Math.max(0, amount01 - stick) * Sk.vergeOverspillToSeatShare;

  let next = unit;
  if (stick > 1e-6) {
    const prevScore = load;
    next = setAnalVergeBag(next, applyWetSoil(bag, kind, stick));
    next = recordSoilGrowth(
      next,
      'analVerge',
      prevScore,
      analVergeWetPoints(next),
      stick
    );
    // Passive writer: verge dwell feeds anus orificeSlick.
    next = writeAnusSlickFromVergeDwell(next, kind, stick);
  }

  let overspillToSeat01 = 0;
  let drippedOff01 = 0;
  // Saturated verge sheds onto seat film (running rear trail).
  if (overspill01 > 1e-6) {
    const seatBag = getSkinRegionBag(next, 'seat');
    const seatPrev = skinFilmWetPoints(seatBag);
    const seatRoom01 = Math.max(0, (Sk.filmCapacity - seatPrev) / 100);
    const seatStick = Math.min(overspill01, seatRoom01);
    if (seatStick > 1e-6) {
      next = setSkinRegionBag(
        next,
        'seat',
        applyWetSoil(seatBag, kind, seatStick),
        'running'
      );
      next = recordSoilGrowth(
        next,
        skinSnapKey('seat'),
        seatPrev,
        skinFilmWetPoints(getSkinRegionBag(next, 'seat')),
        seatStick
      );
      overspillToSeat01 = seatStick;
    }
    drippedOff01 = Math.max(0, overspill01 - seatStick);
  }

  return { unit: next, stuck01: stick, overspillToSeat01, drippedOff01 };
}

/** Idle evaporate for the anal-verge pool (semen dries faster). */
export function advanceAnalVergeWet(
  unit: DetailedUnit,
  hours: number
): DetailedUnit {
  if (!(hours > 0) || unit.sex !== 'F') return unit;
  const bag = getAnalVergeBag(unit);
  if (skinFilmWetPoints(bag) < 0.15) return unit;
  const Sk = T.cycle.clothSeepage.skinDrip;
  const nextBag = emptySoilBag();
  for (const kind of SOIL_KINDS) {
    const mult = kind === 'semen' ? Sk.vergeSemenEvaporateMult : 1;
    const rate = Sk.vergeEvaporatePerHour * mult;
    const lost = bag[kind].wet * (1 - Math.exp(-rate * hours));
    nextBag[kind] = {
      wet: clamp100(bag[kind].wet - lost),
      dry: bag[kind].dry,
    };
  }
  const prevScore = skinFilmWetPoints(bag);
  const next = setAnalVergeBag(unit, nextBag);
  return recordSoilGrowth(
    next,
    'analVerge',
    prevScore,
    analVergeWetPoints(next),
    0
  );
}

/**
 * Bare-skin free-running film (uncovered skin only).
 * Does not soak into flesh; thin film; will not drench a whole leg.
 * Feel is marked running so idle advance can migrate downhill.
 * Seat-chain deposits also fill anal-verge dwell.
 */
export function applySkinSurfaceDrip(
  unit: DetailedUnit,
  kind: FluidSoilKind,
  amount01: number,
  posture: EncounterPosture = 'standing'
): { unit: DetailedUnit; filmStuck01: number; drippedOff01: number } {
  const Sk = T.cycle.clothSeepage.skinDrip;
  let flow = Math.max(0, amount01);
  let filmStuck01 = 0;
  let drippedOff01 = 0;
  if (!(flow > 1e-6)) {
    return { unit, filmStuck01: 0, drippedOff01: 0 };
  }

  const chain = skinRunChain(posture);

  let next = unit;
  for (const region of chain) {
    if (flow < 1e-6) break;
    const bag = getSkinRegionBag(next, region);
    const prevScore = skinFilmWetPoints(bag);
    const load = prevScore;
    const room01 = Math.max(0, (Sk.filmCapacity - load) / 100);
    const intended = flow * Sk.filmStickShare;
    const stick = Math.min(intended, room01);
    if (stick > 1e-6) {
      const soiled = applyWetSoil(bag, kind, stick);
      next = setSkinRegionBag(next, region, soiled, 'running');
      const nextScore = skinFilmWetPoints(getSkinRegionBag(next, region));
      next = recordSoilGrowth(
        next,
        skinSnapKey(region),
        prevScore,
        nextScore,
        stick
      );
      filmStuck01 += stick;
    }
    // Seat station: dwell from arrival (intended), not only what fit on seat film.
    if (region === 'seat' && intended > 1e-6) {
      const dwell = applyAnalVergeDwell(next, kind, intended);
      next = dwell.unit;
      filmStuck01 += dwell.overspillToSeat01;
      drippedOff01 += dwell.drippedOff01;
    }
    const runoff = Math.min(
      Math.max(0, flow - stick),
      Sk.maxRunoffPerApply01
    );
    flow = runoff;
  }

  // Leftover after calf (or end of chain) drips off the body.
  if (flow > 1e-6) {
    drippedOff01 = flow * Sk.dripOffShare;
  }
  return { unit: next, filmStuck01, drippedOff01 };
}

/**
 * Idle skin film: running migrates downhill when uncovered; tacky evaporates in place.
 * While legwear is worn, nothing runs — cloth already held the path.
 */
export function advanceSkinSurfaceDrip(
  unit: DetailedUnit,
  hours: number,
  posture: EncounterPosture = 'standing'
): DetailedUnit {
  if (!(hours > 0) || unit.sex !== 'F') return unit;
  const Sk = T.cycle.clothSeepage.skinDrip;
  const hasLeg = !!getEquippedItem(unit, 'leg');
  let next = advanceAnalVergeWet(unit, hours);
  next = advanceOrificeSlick(next, hours);

  // Tacky (and any film under pants): evaporate in place — no downhill run.
  const tackyEvap = 1 - Math.exp(-Sk.tackyEvaporatePerHour * hours);
  for (const region of SKIN_DRIP_ORDER) {
    const feel = getSkinRegionFeel(next, region);
    if (!hasLeg && feel === 'running') continue;
    const bag = getSkinRegionBag(next, region);
    if (skinFilmWetPoints(bag) < 0.2) continue;
    const nextBag = emptySoilBag();
    for (const kind of SOIL_KINDS) {
      const lost = bag[kind].wet * tackyEvap;
      nextBag[kind] = {
        wet: clamp100(bag[kind].wet - lost),
        dry: bag[kind].dry,
      };
    }
    next = setSkinRegionBag(next, region, nextBag, feel);
  }

  if (hasLeg) return next;

  // Uncovered: migrate running film down the posture chain.
  const migrate = 1 - Math.exp(-Sk.migratePerHour * hours);
  const chain = skinRunChain(posture);

  for (let i = 0; i < chain.length; i++) {
    const region = chain[i]!;
    if (getSkinRegionFeel(next, region) !== 'running') continue;
    const bag = getSkinRegionBag(next, region);
    const prevScore = skinFilmWetPoints(bag);
    let movedTotal = 0;
    const nextBag = emptySoilBag();
    for (const kind of SOIL_KINDS) {
      const wet = bag[kind].wet;
      const move = wet * migrate;
      nextBag[kind] = {
        wet: clamp100(wet - move),
        dry: bag[kind].dry,
      };
      movedTotal += move;
    }
    next = setSkinRegionBag(next, region, nextBag, 'running');
    next = recordSoilGrowth(
      next,
      skinSnapKey(region),
      prevScore,
      skinFilmWetPoints(getSkinRegionBag(next, region)),
      0
    );
    if (movedTotal < 0.2) continue;
    if (i + 1 < chain.length) {
      const dest = chain[i + 1]!;
      const destPrev = skinFilmWetPoints(getSkinRegionBag(next, dest));
      let destBag = getSkinRegionBag(next, dest);
      for (const kind of SOIL_KINDS) {
        const wetPts = bag[kind].wet * migrate;
        if (wetPts > 0.01) {
          destBag = applyWetSoil(destBag, kind, wetPts / 100);
        }
      }
      // Downstream of a run stays running unless already tacky.
      next = setSkinRegionBag(next, dest, destBag, 'running');
      next = recordSoilGrowth(
        next,
        skinSnapKey(dest),
        destPrev,
        skinFilmWetPoints(getSkinRegionBag(next, dest)),
        movedTotal / 100
      );
    }
  }
  return next;
}

/**
 * When a wet garment is peeled, leave tacky/smeared damp on skin where cloth was wet.
 * Freshly bared thighs after soaked pants — smear, not a free-running trail.
 */
export function transferGarmentDampToSkin(
  unit: DetailedUnit,
  item: Item
): DetailedUnit {
  const share = T.cycle.clothSeepage.skinDrip.undressTransferShare;
  if (!(share > 0)) return unit;
  const regions: ClothSoilRegion[] = ['crotch', 'seat', 'innerThigh', 'hem'];
  let next = unit;
  for (const region of regions) {
    const bag = normalizeSoilBag(soilBagForRegion(item, region));
    const skinRegion = clothRegionToSkin(region);
    if (!skinRegion) continue;
    for (const kind of SOIL_KINDS) {
      const wet01 = (bag[kind].wet ?? 0) / 100;
      const amount01 = wet01 * share;
      if (amount01 < 0.002) continue;
      const Sk = T.cycle.clothSeepage.skinDrip;
      const skinBag = getSkinRegionBag(next, skinRegion);
      const load = skinFilmWetPoints(skinBag);
      const room01 = Math.max(0, (Sk.filmCapacity - load) / 100);
      const stick = Math.min(amount01, room01);
      if (stick > 1e-6) {
        next = setSkinRegionBag(
          next,
          skinRegion,
          applyWetSoil(skinBag, kind, stick),
          'tacky'
        );
      }
    }
  }
  return next;
}

export interface CrotchSeepageResult {
  unit: DetailedUnit;
  layers: SeepageLayerResult[];
  skinAmount01: number;
  /** True when fluid stuck on a layer outside underwear. */
  outerSeep: boolean;
  /** Bare-skin film deposited this apply. */
  skinFilm01: number;
  /** Amount reserved / applied to partner (mounted). */
  partnerDrip01: number;
  partner?: DetailedUnit;
}

/**
 * Shared crotch seepage engine (kind-open).
 * Cloth absorbs by posture; skin under wet cloth is contact-wicked (tacky).
 * Free-running bare-skin trail only when that path is uncovered (no legwear).
 * Mounted reserves a share for partner crotch cloth.
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
  let partner = opts?.partner;
  let outerSeep = false;
  let partnerDrip01 = 0;
  let skinFilm01 = 0;

  if (!(flow > 1e-6)) {
    return {
      unit,
      layers: [],
      skinAmount01: 0,
      outerSeep: false,
      skinFilm01: 0,
      partnerDrip01: 0,
      partner,
    };
  }

  const layers = crotchSeepageLayers(unit, posture);
  /** Pants or reclined dress — outer cloth holds runoff (no free skin past it). */
  const hasOuterCloth = layers.some((l) => l.slot !== 'underwear');

  if (layers.length === 0) {
    // Nude / no crotch cloth — mounted can still soil partner; rest → running skin trail.
    if (posture === 'mounted' && flow > 1e-6) {
      partnerDrip01 = flow * S.partnerDripShareMounted;
      flow = Math.max(0, flow - partnerDrip01);
      if (partner && partnerDrip01 > 0.002) {
        const pResult = applyCrotchFluidSeepage(partner, kind, partnerDrip01, {
          posture: 'seated',
        });
        partner = pResult.unit;
      }
    }
    const skin = applySkinSurfaceDrip(nextUnit, kind, flow, posture);
    return {
      unit: skin.unit,
      layers: [],
      skinAmount01: skin.filmStuck01,
      outerSeep: false,
      skinFilm01: skin.filmStuck01,
      partnerDrip01,
      partner,
    };
  }

  for (let i = 0; i < layers.length; i++) {
    if (flow < 1e-6) break;
    const item = layers[i]!;
    const isOuter = item.slot !== 'underwear';

    // After underwear, mounted posture diverts a share to partner before her outer cloth.
    if (
      isOuter &&
      posture === 'mounted' &&
      partnerDrip01 <= 0 &&
      flow > 1e-6
    ) {
      partnerDrip01 = flow * S.partnerDripShareMounted;
      flow = Math.max(0, flow - partnerDrip01);
      if (partner && partnerDrip01 > 0.002) {
        const pResult = applyCrotchFluidSeepage(partner, kind, partnerDrip01, {
          posture: 'seated',
        });
        partner = pResult.unit;
      }
    }

    const regions = regionChainForLayer(item, posture);
    for (const region of regions) {
      if (flow < 1e-6) break;
      const { stuck, through } = splitLateralAndThrough(item, flow, region);
      if (stuck > 1e-6) {
        const prevScore = regionSoilScore(item, region);
        applyWetSoilToItemRegion(item, kind, stuck, region);
        nextUnit = recordSoilGrowth(
          nextUnit,
          clothSnapKey(item.slot, region),
          prevScore,
          regionSoilScore(item, region),
          stuck
        );
        layersHit.push({
          slot: item.slot,
          name: item.name,
          amount01: stuck,
          region,
        });
        if (isOuter) outerSeep = true;
        // Contact wick under wet cloth; seat stick feeds anal-verge dwell.
        nextUnit = applyClothContactWick(nextUnit, kind, region, stuck);
        skinFilm01 += stuck * S.skinDrip.clothWickToSkinShare;
        if (region === 'seat') {
          nextUnit = applyAnalVergeDwell(nextUnit, kind, stuck).unit;
        }
      }
      flow = through;
    }

    if (isOuter) {
      // Outer pants/dress holds leftover — no free skin runoff past it.
      if (hasOuterCloth) flow = 0;
    } else if (!hasOuterCloth && flow > 1e-6) {
      // Underwear done; no outer cloth → bare trail (or partner if mounted).
      if (posture === 'mounted' && partnerDrip01 <= 0) {
        partnerDrip01 = flow * S.partnerDripShareMounted;
        flow = Math.max(0, flow - partnerDrip01);
        if (partner && partnerDrip01 > 0.002) {
          const pResult = applyCrotchFluidSeepage(partner, kind, partnerDrip01, {
            posture: 'seated',
          });
          partner = pResult.unit;
        }
      }
      break;
    }
  }

  // Bare-skin free runoff only when uncovered (panties / nude path).
  let skinAmount01 = skinFilm01;
  if (!hasOuterCloth && flow > 1e-6) {
    const skin = applySkinSurfaceDrip(nextUnit, kind, flow, posture);
    nextUnit = skin.unit;
    skinFilm01 += skin.filmStuck01;
    skinAmount01 = skinFilm01 + skin.drippedOff01;
  }

  return {
    unit: nextUnit,
    layers: layersHit,
    skinAmount01,
    outerSeep,
    skinFilm01,
    partnerDrip01,
    partner,
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

export interface DischargeSoilResult {
  unit: DetailedUnit;
  partner?: DetailedUnit;
  partnerDrip01: number;
}

export function applyDischargesToRecipientSoil(
  recipient: DetailedUnit,
  discharges: FluidDischargeEvent[],
  recipientIsTarget: boolean,
  opts?: {
    encounterArousal?: number;
    posture?: EncounterPosture;
    partner?: DetailedUnit;
  }
): DischargeSoilResult {
  if (!recipientIsTarget || recipient.sex !== 'F') {
    return { unit: recipient, partner: opts?.partner, partnerDrip01: 0 };
  }
  let unit = recipient;
  let partner = opts?.partner;
  let partnerDrip01 = 0;
  const elevated = isFeminineArousalElevated(unit, opts?.encounterArousal);
  const seepOpts: CrotchSeepageOpts = {
    posture: opts?.posture ?? 'standing',
    partner,
  };
  for (const d of discharges) {
    const kind = soilKindFromDischarge(d.kind);
    if (!kind) continue;
    if (d.kind === 'semen' || d.kind === 'preEjaculate') {
      if (d.fromId === recipient.id) continue;
      const r = applyCrotchFluidSeepage(unit, kind, d.volume * 0.85, {
        ...seepOpts,
        partner,
      });
      unit = r.unit;
      if (r.partner) partner = r.partner;
      partnerDrip01 += r.partnerDrip01;
      if (elevated) {
        const a = applyCrotchFluidSeepage(unit, 'arousalFluid', d.volume * 0.28, {
          ...seepOpts,
          partner,
        });
        unit = a.unit;
        if (a.partner) partner = a.partner;
        partnerDrip01 += a.partnerDrip01;
      }
    } else if (d.fromId === recipient.id) {
      if (d.kind === 'femaleEjaculate') {
        // One truth volume → orifice retain + cloth seep.
        const orificeShare = d.orificeShare ?? T.cycle.femaleClimaxFluid.orificeShare;
        const clothShare = d.clothShare ?? T.cycle.femaleClimaxFluid.clothShare;
        const orificeAmt = d.volume * orificeShare;
        if (orificeAmt > 1e-6) {
          const prev = unit.lewdStats.dynamic.orificeSlick ?? {};
          const vagina = addOrificeSlickLayer(
            prev.vagina,
            'vaginalSecretion',
            orificeAmt
          );
          unit = setOrificeSlick(unit, { ...prev, vagina });
        }
        const clothAmt = d.volume * clothShare;
        if (clothAmt > 1e-6) {
          const r = applyCrotchFluidSeepage(unit, kind, clothAmt, {
            ...seepOpts,
            partner,
          });
          unit = r.unit;
          if (r.partner) partner = r.partner;
          partnerDrip01 += r.partnerDrip01;
        }
      } else {
        const r = applyCrotchFluidSeepage(unit, kind, d.volume * 0.55, {
          ...seepOpts,
          partner,
        });
        unit = r.unit;
        if (r.partner) partner = r.partner;
        partnerDrip01 += r.partnerDrip01;
      }
    }
  }
  return { unit, partner, partnerDrip01 };
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
    partner?: DetailedUnit;
  }
): DetailedUnit {
  if (unit.sex !== 'F' || !(hours > 0)) return unit;
  // Lust trickle produces fluid (truth) into orifice + cloth share.
  const trickle = accrueLustSecretionTrickle(unit, hours);
  unit = trickle.unit;
  let cloth01 = trickle.cloth01;

  const D = T.cycle.arousalDrip;
  const cap = T.cycle.wetnessCap;
  const wet = feltWetnessForUnit(unit, {
    encounterArousal: opts?.encounterArousal,
    desireMood01: opts?.desireMood01,
  });
  if (wet && wet.feltWetness >= D.soilFromWetnessThreshold) {
    const intensity =
      (wet.feltWetness - D.soilFromWetnessThreshold) /
      Math.max(0.01, cap - D.soilFromWetnessThreshold);
    cloth01 += D.amountPerHourAtCap * intensity * hours;
  }
  if (cloth01 < 0.002) return unit;
  return applyCrotchFluidSeepage(unit, 'arousalFluid', cloth01, {
    posture: opts?.posture ?? 'standing',
    partner: opts?.partner,
  }).unit;
}

/**
 * Same as accrueArousalWetSpotDrip but also returns partner soil (mounted).
 */
export function accrueArousalWetSpotDripWithPartner(
  unit: DetailedUnit,
  hours: number,
  opts?: {
    encounterArousal?: number;
    desireMood01?: number;
    posture?: EncounterPosture;
    partner?: DetailedUnit;
  }
): { unit: DetailedUnit; partner?: DetailedUnit; partnerDrip01: number } {
  if (unit.sex !== 'F' || !(hours > 0)) {
    return { unit, partner: opts?.partner, partnerDrip01: 0 };
  }
  const trickle = accrueLustSecretionTrickle(unit, hours);
  unit = trickle.unit;
  let amount01 = trickle.cloth01;

  const D = T.cycle.arousalDrip;
  const cap = T.cycle.wetnessCap;
  const wet = feltWetnessForUnit(unit, {
    encounterArousal: opts?.encounterArousal,
    desireMood01: opts?.desireMood01,
  });
  if (wet && wet.feltWetness >= D.soilFromWetnessThreshold) {
    const intensity =
      (wet.feltWetness - D.soilFromWetnessThreshold) /
      Math.max(0.01, cap - D.soilFromWetnessThreshold);
    amount01 += D.amountPerHourAtCap * intensity * hours;
  }
  if (amount01 < 0.002) {
    return { unit, partner: opts?.partner, partnerDrip01: 0 };
  }
  const r = applyCrotchFluidSeepage(unit, 'arousalFluid', amount01, {
    posture: opts?.posture ?? 'standing',
    partner: opts?.partner,
  });
  return {
    unit: r.unit,
    partner: r.partner,
    partnerDrip01: r.partnerDrip01,
  };
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
  hours: number,
  opts?: { posture?: EncounterPosture; partner?: DetailedUnit }
): DetailedUnit {
  if (unit.sex !== 'F' || !(hours > 0)) return unit;
  const cohorts = unit.lewdStats.dynamic.spermCohorts;
  if (!cohorts?.length) return unit;
  const S = T.cycle.clothSeepage;
  const seepOpts: CrotchSeepageOpts = {
    posture: opts?.posture ?? 'standing',
    partner: opts?.partner,
  };

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
    next = applyCrotchFluidSeepage(next, 'semen', vaginalLeak, seepOpts).unit;
  }
  // Anal retention leak stub (plug / tropes later — rate only for now).
  const analLeak = analVol * S.analSemenLeakPerHour * hours;
  if (analLeak >= 0.002) {
    next = applyCrotchFluidSeepage(next, 'semen', analLeak, seepOpts).unit;
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
  for (const slot of CROTCH_SEEPAGE_SLOTS) {
    const item = getEquippedItem(unit, slot);
    if (item && (item.lewdStats.soiled || item.lewdStats.soiledByRegion)) {
      dryItemRegions(item, hours);
    }
  }
  // Skin film does not soak in — light surface evaporate only (no wet→dry cloth soak).
  const map = unit.lewdStats.dynamic.skinFluidByRegion;
  let skinFluidByRegion = map ? { ...map } : undefined;
  let crotchSoil = drySoilBag(unit.lewdStats.dynamic.crotchSoil, hours);
  if (skinFluidByRegion) {
    const evaporate = 1 - Math.exp(-0.45 * hours);
    for (const region of SKIN_DRIP_ORDER) {
      const bag = normalizeSoilBag(skinFluidByRegion[region]);
      const nextBag = emptySoilBag();
      for (const kind of SOIL_KINDS) {
        const lost = bag[kind].wet * evaporate;
        nextBag[kind] = {
          wet: clamp100(bag[kind].wet - lost),
          dry: bag[kind].dry, // faint residue only if already set
        };
      }
      skinFluidByRegion[region] = nextBag;
    }
    crotchSoil = normalizeSoilBag(skinFluidByRegion.crotch);
  }
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: {
        ...unit.lewdStats.dynamic,
        crotchSoil,
        ...(skinFluidByRegion ? { skinFluidByRegion } : {}),
      },
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
        skinFluidByRegion: undefined,
        skinFilmFeelByRegion: undefined,
        soilScoreSnap: undefined,
        soilGrowthRate: undefined,
        analVergeWet: undefined,
        orificeSlick: undefined,
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
        skinFluidByRegion: undefined,
        skinFilmFeelByRegion: undefined,
        soilScoreSnap: undefined,
        soilGrowthRate: undefined,
        analVergeWet: undefined,
        orificeSlick: undefined,
      },
    },
  };
}

export interface RegionWetCue {
  region: ClothSoilRegion;
  /** Legacy WetPatchSize band for thresholds. Prefer label. */
  size: WetPatchSize;
  /** Accumulation phrase: pinprick/coin… or hint of discoloration… */
  label: string;
  /** Growth-rate flavor for narrative. */
  rate: WetGrowthRate;
  rateLabel: string;
  /** Optional narrative combining accumulation + rate. */
  narrative: string;
  score: number;
}

export interface SkinFilmCue {
  region: SkinDripRegion;
  size: WetPatchSize;
  feel: SkinFilmFeel;
  /** Accumulation / form phrase for short cues. */
  label: string;
  rate: WetGrowthRate;
  rateLabel: string;
  /** Reach range label when running (thigh or seat). */
  rangeLabel?: string;
  narrative: string;
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
  /** Bare-skin surface film trail (does not soak in). */
  skinRegions: SkinFilmCue[];
  /** Combined narrative flavor lines (cloth stains + skin runs). */
  narratives: string[];
  /**
   * Lasting anal-verge pool has meaningful wetness (prefer over transient seat range).
   * Hook for future multi-lubricant orifice slick — not a comfort gate yet.
   */
  analVergeWet: boolean;
  /** Soft 0–1 from verge pool score vs vergeCapacity. */
  analVergeWet01: number;
  /** Short cue / narrative for the verge pool. */
  analVergeLabel: string | null;
  /** Anus orificeSlick blend (fed by verge dwell for now). */
  anusSlick: OrificeSlickReport | null;
  /** Vagina orificeSlick blend (arousal-gated secretion + climax). */
  vaginaSlick: OrificeSlickReport | null;
  summary: string;
  /** Quantified crotch dampness + flavor (arousal / semen). */
  wetness: UnderwearWetnessReport;
}

function legRegionCues(
  unit: DetailedUnit,
  leg: Item | undefined
): RegionWetCue[] {
  if (!leg) return [];
  const regions: ClothSoilRegion[] = ['crotch', 'seat', 'innerThigh'];
  const out: RegionWetCue[] = [];
  for (const region of regions) {
    const score = regionSoilScore(leg, region);
    const size = sizeFromWetScore(score);
    if (size === 'none') continue;
    const rate = growthRateForKey(unit, clothSnapKey('leg', region));
    const where =
      region === 'seat'
        ? 'seat'
        : region === 'innerThigh'
          ? 'inner thigh'
          : 'crotch';
    const label = legRegionWetLabel(region, score);
    const narrative =
      region === 'crotch'
        ? ''
        : narrateClothStain({
            where,
            score,
            rate,
            garmentName: leg.name,
          });
    out.push({
      region,
      size,
      label,
      rate,
      rateLabel: growthRateLabel(rate),
      narrative,
      score,
    });
  }
  return out;
}

function skinFilmCues(
  unit: DetailedUnit,
  posture: EncounterPosture
): SkinFilmCue[] {
  const out: SkinFilmCue[] = [];
  const contents = fluidContentsWord(unit);
  const thighScore = skinFilmWetPoints(getSkinRegionBag(unit, 'thighInner'));
  const calfScore = skinFilmWetPoints(getSkinRegionBag(unit, 'calf'));
  const seatScore = skinFilmWetPoints(getSkinRegionBag(unit, 'seat'));
  const thighRange = bareThighRangeFromRegions(
    { thighInner: thighScore, calf: calfScore },
    posture
  );
  const seatRange = bareSeatRangeFromScore(seatScore);

  let wroteThighNarrative = false;

  for (const region of SKIN_DRIP_ORDER) {
    const bag = getSkinRegionBag(unit, region);
    const score = skinFilmWetPoints(bag);
    const size = sizeFromWetScore(score);
    if (size === 'none') continue;
    const feel = getSkinRegionFeel(unit, region);
    const rate = growthRateForKey(unit, skinSnapKey(region));
    const label = skinRegionWetLabel(feel, score);
    let rangeLabel: string | undefined;
    let narrative = '';

    if (feel === 'tacky') {
      narrative = `${label} on ${skinRegionWhere(region)}`;
    } else if (region === 'seat') {
      rangeLabel =
        seatRange === 'none' ? undefined : bareSeatRangeLabel(seatRange);
      narrative = narrateBareSeatRun({
        form: bareSkinFormFromScore(seatScore),
        range: seatRange,
        rate,
        contents,
      });
    } else if (region === 'thighInner' || region === 'calf') {
      if (!wroteThighNarrative && thighRange !== 'none') {
        rangeLabel = bareSkinRangeLabel(thighRange);
        narrative = narrateBareThighRun({
          form: bareSkinFormFromScore(Math.max(thighScore, calfScore)),
          range: thighRange,
          rate,
          contents,
        });
        wroteThighNarrative = true;
      }
    } else {
      narrative = `${label} at the crotch`;
    }

    out.push({
      region,
      size,
      feel,
      label,
      rate,
      rateLabel: growthRateLabel(rate),
      rangeLabel,
      narrative,
      score,
    });
  }
  return out;
}

function skinRegionWhere(region: SkinDripRegion): string {
  if (region === 'thighInner') return 'inner thigh';
  if (region === 'calf') return 'calf';
  if (region === 'seat') return 'seat';
  return 'crotch';
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
  const posture = opts?.posture ?? 'standing';
  const legRegions = legRegionCues(unit, leg);
  const skinRegions = skinFilmCues(unit, posture);

  const pantySemen = soilIntensity(cloth.semen);
  const pantyBlood = soilIntensity(cloth.blood);
  const pantyDischarge =
    soilIntensity(cloth.vaginalDischarge) + soilIntensity(cloth.arousalFluid);
  const skinTotal =
    totalSoilScore(skin) +
    skinRegions.reduce((sum, r) => sum + r.score, 0);
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
    outerSeep ||
    skinRegions.length > 0;

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
    const rateBit =
      r.region !== 'crotch' && r.rate !== 'clearlyEstablished'
        ? ` (${r.rateLabel})`
        : r.region !== 'crotch' && r.rate === 'clearlyEstablished'
          ? ' (established)'
          : '';
    bits.push(`${leg?.name ?? 'leg'} ${where} ${r.label}${rateBit}`);
  }
  if (outerSeep && legRegions.length === 0) {
    bits.push(leg ? `seeped through ${leg.name}` : 'outer seep');
  }
  for (const r of skinRegions) {
    if (r.feel === 'tacky') {
      bits.push(`skin ${skinRegionWhere(r.region)} smear ${r.label}`);
    } else if (r.rangeLabel) {
      bits.push(`skin ${r.label} ${r.rangeLabel}`);
    } else if (r.narrative) {
      // thigh/calf companion rows without their own range — skip duplicate
      if (r.region === 'calf' && !r.rangeLabel) continue;
      bits.push(`skin ${skinRegionWhere(r.region)} flow ${r.label}`);
    } else if (r.region === 'crotch') {
      bits.push(`skin crotch flow ${r.label}`);
    }
  }
  if (posture !== 'standing') {
    bits.push(posture);
  }
  if (wantsBath) bits.push('wants a bath');

  const narratives = [
    ...legRegions.map((r) => r.narrative).filter(Boolean),
    ...skinRegions.map((r) => r.narrative).filter(Boolean),
  ];

  const vergeScore = analVergeWetPoints(unit);
  const vergeCap = T.cycle.clothSeepage.skinDrip.vergeCapacity;
  const analVergeWet01 = Math.max(
    0,
    Math.min(1, vergeScore / Math.max(1, vergeCap))
  );
  const analVergeWet = vergeScore >= 3.5;
  const vergeRate = growthRateForKey(unit, 'analVerge');
  let analVergeLabel: string | null = null;
  if (analVergeWet) {
    const form = bareSkinFormFromScore(vergeScore);
    const formLabel = form === 'none' ? 'slick' : bareSkinFormLabel(form);
    if (vergeRate === 'clearlyEstablished') {
      analVergeLabel = `a clearly established ${formLabel} at the anal verge`;
    } else {
      const pace =
        vergeRate === 'slowlyCreeping'
          ? 'slowly'
          : vergeRate === 'swiftlyBlossoming'
            ? 'swiftly'
            : 'steadily';
      analVergeLabel = `a ${formLabel} of wetness ${pace} wetting the anal verge`;
    }
    bits.push(`verge ${formLabel}`);
    narratives.push(analVergeLabel);
  } else {
    // Transient seat-range only if pool empty but trail just kissed the verge.
    const seatScore = skinFilmWetPoints(getSkinRegionBag(unit, 'seat'));
    const seatRange = bareSeatRangeFromScore(seatScore);
    if (seatTrailWetsAnalVerge(seatRange)) {
      analVergeLabel = 'seat trail at the anal verge (no dwell yet)';
    }
  }

  const anusSlickReport = describeOrificeSlick(
    'anus',
    unit.lewdStats.dynamic.orificeSlick?.anus
  );
  const anusSlick =
    anusSlickReport.wet01 >= 0.02 ? anusSlickReport : null;
  if (anusSlick) {
    bits.push(`anus slick ${anusSlick.label.replace(/^anus\s+/, '')}`);
    if (anusSlick.flavor) narratives.push(anusSlick.flavor);
  }

  const vaginaSlickReport = describeOrificeSlick(
    'vagina',
    unit.lewdStats.dynamic.orificeSlick?.vagina
  );
  const vaginaSlick =
    vaginaSlickReport.wet01 >= 0.02 ? vaginaSlickReport : null;
  if (vaginaSlick) {
    bits.push(`vagina slick ${vaginaSlick.label.replace(/^vagina\s+/, '')}`);
    if (vaginaSlick.flavor) narratives.push(vaginaSlick.flavor);
  }

  return {
    soiledPanty,
    soiledPeriodCloth,
    visibleResidue,
    wantsBath,
    outerSeep,
    legRegions,
    skinRegions,
    narratives,
    analVergeWet,
    analVergeWet01,
    analVergeLabel,
    anusSlick,
    vaginaSlick,
    summary: bits.length ? bits.join(' · ') : 'clean',
    wetness,
  };
}

export interface AdvanceFluidSoilOpts {
  /** Ephemeral encounter arousal 0–100 (Lewd Lab idle). */
  encounterArousal?: number;
  /** Reserved mild desire / mood 0–1 (arousal-wetness hook). */
  desireMood01?: number;
  /** Standing vs seated/lying / handsKnees / sideLying / mounted cloth routing. */
  posture?: EncounterPosture;
  /** Partner for mounted/cowgirl overflow (Lab). */
  partner?: DetailedUnit;
}

export interface AdvanceFluidSoilResult {
  unit: DetailedUnit;
  partner?: DetailedUnit;
  partnerDrip01: number;
}

/** Pass Time: dry soil + menses + arousal drip + retained semen leak + skin film runoff. */
export function advanceFluidSoil(
  unit: DetailedUnit,
  hours: number,
  opts?: AdvanceFluidSoilOpts
): DetailedUnit {
  return advanceFluidSoilDetailed(unit, hours, opts).unit;
}

/** Same as advanceFluidSoil, also returns partner soil when mounted. */
export function advanceFluidSoilDetailed(
  unit: DetailedUnit,
  hours: number,
  opts?: AdvanceFluidSoilOpts
): AdvanceFluidSoilResult {
  if (!(hours > 0)) {
    return { unit, partner: opts?.partner, partnerDrip01: 0 };
  }
  const posture = opts?.posture ?? 'standing';
  let next = dryUnitAndUnderwearSoil(unit, hours);
  next = accrueMenstrualBlood(next, hours);
  const drip = accrueArousalWetSpotDripWithPartner(next, hours, {
    encounterArousal: opts?.encounterArousal,
    desireMood01: opts?.desireMood01,
    posture,
    partner: opts?.partner,
  });
  next = drip.unit;
  let partner = drip.partner;
  const partnerDrip01 = drip.partnerDrip01;
  next = accrueRetainedSemenLeak(next, hours, { posture, partner });
  next = advanceSkinSurfaceDrip(next, hours, posture);
  return { unit: next, partner, partnerDrip01 };
}
