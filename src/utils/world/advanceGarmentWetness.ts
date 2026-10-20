import {
  GARMENT_WET_SLOTS,
  GARMENT_WET_TUNING as T,
} from '../../data/world/garmentWetTuning';
import {
  cloakRainCoverageForSize,
  formatCloakSizeLabel,
  type CloakRainSlotCoverage,
  type CloakSize,
} from '../../data/world/cloakRainCoverage';
import { getItemTemplate } from '../../data/catalog/itemTemplates';
import { COMBAT_CAST_INVENTORIES } from '../../data/starters/combatCastInventory';
import type { Unit as DetailedUnit } from '../../types/characters';
import type { Item, ItemSlot } from '../../types/items';
import type { WeatherExposure } from './weatherExposure';

export interface GarmentWetOpts {
  sheltered?: boolean;
  /** Heat-stress at start of tick (sweat writer). */
  heatStress01?: number;
  itemsById?: Record<string, Item>;
  /** World precip 0–1. Slot soak uses cloak rain coverage + saturation. */
  precip01?: number;
  wind01?: number;
}

export interface GarmentWetAdvanceResult {
  itemsById: Record<string, Item>;
  /** Coverage-weighted mean of worn envWet01 (0–1). */
  wornEnvWet01: number;
  /** Evaporative chill to subtract from felt ambient (°F). */
  evaporativeChillF: number;
  summary: string;
  wornDamp: Array<{ slot: ItemSlot; name: string; envWet01: number }>;
  doffedDamp: Array<{ id: string; name: string; envWet01: number }>;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function approach(value: number, target: number, rate: number, hours: number): number {
  if (!(hours > 0) || rate <= 0) return value;
  return value + (target - value) * (1 - Math.exp(-rate * hours));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function readEnvWet01(item: Item | null | undefined): number {
  if (!item) return 0;
  const v = item.lewdStats?.envWet01;
  return typeof v === 'number' ? clamp01(v) : 0;
}

export function setEnvWet01(item: Item, wet: number): Item {
  const next = clamp01(wet);
  item.lewdStats = { ...item.lewdStats, envWet01: round3(next) };
  return item;
}

function isGarmentWetSlot(slot: ItemSlot): boolean {
  return (GARMENT_WET_SLOTS as readonly string[]).includes(slot);
}

function resolveItem(
  id: string,
  itemsById?: Record<string, Item>
): Item | null {
  if (itemsById?.[id]) return itemsById[id]!;
  for (const kit of Object.values(COMBAT_CAST_INVENTORIES)) {
    if (kit.items[id]) return kit.items[id]!;
  }
  // Template-id fallback (equipment sometimes stores template ids)
  if (getItemTemplate(id)) return null;
  return null;
}

function ensureBank(
  unit: DetailedUnit,
  itemsById?: Record<string, Item>
): Record<string, Item> {
  const bank: Record<string, Item> = { ...(itemsById ?? {}) };
  for (const id of Object.values(unit.equipment)) {
    if (!id || bank[id]) continue;
    const found = resolveItem(id, itemsById);
    if (found) bank[id] = found;
  }
  return bank;
}

function sweatMult(slot: ItemSlot): number {
  return T.sweatSlotMult[slot] ?? T.sweatFallbackMult;
}

function evaporativeWeight(slot: ItemSlot): number {
  return T.evaporativeSlotWeight[slot] ?? T.evaporativeFallbackWeight;
}

function dampLabel(wet: number): string {
  if (wet >= T.soakedThreshold) return 'soaked';
  if (wet >= 0.28) return 'wet';
  if (wet >= T.dampThreshold) return 'damp';
  return 'dry';
}

/** Resolve cloakSize from a worn/back item template (defaults medium for legacy cloaks). */
export function resolveCloakSize(item: Item | null | undefined): CloakSize | null {
  if (!item || item.slot !== 'back') return null;
  const tpl = getItemTemplate(item.templateId);
  if (tpl?.cloakSize) return tpl.cloakSize;
  if (/cloak/i.test(item.name) || /cloak/i.test(item.templateId)) return 'medium';
  return null;
}

export function resolveWornCloakRain(
  unit: DetailedUnit,
  itemsById?: Record<string, Item>
): {
  cloak: Item | null;
  size: CloakSize | null;
  coverage: CloakRainSlotCoverage;
  cloakWet01: number;
  saturated: boolean;
} {
  const bank = ensureBank(unit, itemsById);
  const backId = unit.equipment.back;
  const cloak = backId ? bank[backId] ?? null : null;
  const size = resolveCloakSize(cloak);
  const coverage = size ? cloakRainCoverageForSize(size) : {};
  const cloakWet01 = readEnvWet01(cloak);
  return {
    cloak,
    size,
    coverage,
    cloakWet01,
    saturated: !!size && cloakWet01 >= T.cloakSaturateAt,
  };
}

/**
 * How much storm-level precip nullifies cloak wrap coverage (0–1).
 * At precip=1 → 1 (full soak-through); at/below overwhelmStart → 0.
 */
export function precipCoverageOverwhelm01(precip01: number): number {
  const p = clamp01(precip01);
  const start = T.precipCoverageOverwhelmStart;
  if (p <= start) return 0;
  return clamp01((p - start) / (1 - start));
}

/**
 * Rain soak target for a worn slot under current precip + cloak wrap.
 * - Cloak (back): full precip.
 * - Other slots, cloak dry (&lt;50%): precip × (1 − slotCoverage).
 * - Other slots, cloak ≥50% wet: precip × (1 − coverage×0.85)
 *   i.e. uncovered full + covered at 15% through.
 * - Storm precip fades coverage to 0 so clothing can fully wet in ~1h.
 * Callers must also apply `rainOverlayerGate` for undershirt / underwear.
 */
export function rainTargetForSlot(
  slot: ItemSlot,
  precip01: number,
  coverage: CloakRainSlotCoverage,
  cloakSaturated: boolean,
  sheltered: boolean
): number {
  if (sheltered || precip01 <= 0) return 0;
  const precip = clamp01(precip01);
  if (slot === 'back') return precip * T.cloakRainMult;
  const overwhelm = precipCoverageOverwhelm01(precip);
  const cov = clamp01(coverage[slot] ?? 0) * (1 - overwhelm);
  if (cloakSaturated || overwhelm > 0) {
    // When overwhelmed, through→1; when only saturated, use 15% through.
    const through =
      overwhelm > 0
        ? T.cloakSaturatedThrough + (1 - T.cloakSaturatedThrough) * overwhelm
        : T.cloakSaturatedThrough;
    return precip * (1 - cov * (1 - through));
  }
  return precip * (1 - cov);
}

/**
 * Preferred rain overlayers for underclothes (first worn wins).
 * Bra/undershirt under tunic; panties under legs (dress → shirt).
 */
export const RAIN_UNDERLAYER_OVERSLOTS: Partial<Record<ItemSlot, ItemSlot[]>> = {
  undershirt: ['shirt', 'chest'],
  underwear: ['leg', 'shirt'],
};

/** Slots whose rain soak waits on an overlayer past overlayerSaturateAt. */
export function isRainGatedUnderlayer(slot: ItemSlot): boolean {
  return slot === 'undershirt' || slot === 'underwear';
}

/**
 * Which worn piece currently shelters this underlayer from rain, if any.
 * Null = no overlayer worn (underlayer can take rain directly).
 */
export function resolveRainOverlayer(
  unit: DetailedUnit,
  slot: ItemSlot,
  itemsById?: Record<string, Item>
): { slot: ItemSlot; item: Item; envWet01: number } | null {
  const prefs = RAIN_UNDERLAYER_OVERSLOTS[slot];
  if (!prefs) return null;
  const bank = ensureBank(unit, itemsById);
  for (const over of prefs) {
    const id = unit.equipment[over];
    if (!id) continue;
    const item = bank[id];
    if (!item) continue;
    return { slot: over, item, envWet01: readEnvWet01(item) };
  }
  return null;
}

/**
 * Rain gate: underclothes get 0 rain target until overlayer envWet &gt; threshold.
 * No overlayer worn → ungated (bare under rain).
 */
export function rainOverlayerGate(
  unit: DetailedUnit,
  slot: ItemSlot,
  rainTarget: number,
  itemsById?: Record<string, Item>
): number {
  if (!isRainGatedUnderlayer(slot)) return rainTarget;
  const over = resolveRainOverlayer(unit, slot, itemsById);
  if (!over) return rainTarget;
  if (over.envWet01 > T.overlayerSaturateAt) return rainTarget;
  return 0;
}

/**
 * Weighted worn env-wet + evaporative chill from current bank (no mutation).
 */
export function assessWornGarmentWetness(
  unit: DetailedUnit,
  exposure: WeatherExposure,
  itemsById?: Record<string, Item>
): { wornEnvWet01: number; evaporativeChillF: number; wornDamp: GarmentWetAdvanceResult['wornDamp'] } {
  const bank = ensureBank(unit, itemsById);
  let wSum = 0;
  let wWet = 0;
  const wornDamp: GarmentWetAdvanceResult['wornDamp'] = [];
  for (const slot of GARMENT_WET_SLOTS) {
    const id = unit.equipment[slot];
    if (!id) continue;
    const item = bank[id];
    if (!item) continue;
    const wet = readEnvWet01(item);
    const wt = evaporativeWeight(slot);
    wSum += wt;
    wWet += wet * wt;
    if (wet >= T.dampThreshold) {
      wornDamp.push({ slot, name: item.name, envWet01: wet });
    }
  }
  const wornEnvWet01 = wSum > 0 ? clamp01(wWet / wSum) : 0;
  const evaporativeChillF = evaporativeChillFromWorn(wornEnvWet01, {
    sheltered: exposure.sheltered,
  });
  return {
    wornEnvWet01: round3(wornEnvWet01),
    evaporativeChillF,
    wornDamp,
  };
}

/** Evaporative chill with explicit wind01 (Pass Time). */
export function evaporativeChillFromWorn(
  wornEnvWet01: number,
  opts: { sheltered?: boolean; wind01?: number }
): number {
  const wind = opts.sheltered
    ? 0.2
    : Math.max(0.25, Math.min(1, opts.wind01 ?? 0.35));
  let chill = wornEnvWet01 * T.evaporativeMaxF * (0.55 + 0.45 * wind);
  if (opts.sheltered) chill *= T.evaporativeShelteredMult;
  return Math.round(chill * 10) / 10;
}

/**
 * Advance rain/sweat soak + drying on cloth items in the bank.
 * Mutates items in the returned bank (same refs when passed in).
 */
export function advanceGarmentWetness(
  unit: DetailedUnit,
  hours: number,
  exposure: WeatherExposure,
  opts?: GarmentWetOpts
): GarmentWetAdvanceResult {
  const bank = ensureBank(unit, opts?.itemsById);
  const sheltered = opts?.sheltered ?? exposure.sheltered;
  const heat = clamp01(opts?.heatStress01 ?? 0);
  const precip = clamp01(opts?.precip01 ?? 0);
  const wind01 = clamp01(opts?.wind01 ?? 0.35);

  if (!(hours > 0)) {
    const snap = assessWornGarmentWetness(unit, exposure, bank);
    return {
      itemsById: bank,
      wornEnvWet01: snap.wornEnvWet01,
      evaporativeChillF: evaporativeChillFromWorn(snap.wornEnvWet01, {
        sheltered,
        wind01,
      }),
      summary: '',
      wornDamp: snap.wornDamp,
      doffedDamp: listDoffedDamp(unit, bank),
    };
  }

  const wornIds = new Set(
    Object.values(unit.equipment).filter((id): id is string => !!id)
  );

  // Cloak soaks first so under-layer targets see post-tick saturation.
  const cloakInfo = resolveWornCloakRain(unit, bank);
  if (cloakInfo.cloak && unit.equipment.back) {
    let cloakWet = cloakInfo.cloakWet01;
    const cloakTarget = rainTargetForSlot(
      'back',
      precip,
      cloakInfo.coverage,
      false,
      sheltered
    );
    if (cloakTarget > cloakWet) {
      cloakWet = approach(cloakWet, cloakTarget, T.rainSoakPerHour, hours);
    }
    let cloakDry = T.dryWornPerHour;
    if (cloakTarget > 0.15) cloakDry *= T.dryRainPenalty;
    if (sheltered) cloakDry *= T.dryShelteredMult;
    const cloakFloor = cloakTarget * 0.85;
    if (cloakWet > cloakFloor) {
      cloakWet = approach(cloakWet, cloakFloor, cloakDry, hours);
    }
    setEnvWet01(cloakInfo.cloak, cloakWet);
  }

  const coverage = cloakInfo.coverage;
  const cloakSaturated =
    !!cloakInfo.size && readEnvWet01(cloakInfo.cloak) >= T.cloakSaturateAt;

  const advanceWornSlot = (slot: ItemSlot) => {
    const id = unit.equipment[slot];
    if (!id) return;
    const item = bank[id];
    if (!item) return;
    let wet = readEnvWet01(item);

    let rainTarget = rainTargetForSlot(
      slot,
      precip,
      coverage,
      cloakSaturated,
      sheltered
    );
    rainTarget = rainOverlayerGate(unit, slot, rainTarget, bank);

    if (rainTarget > wet) {
      wet = approach(wet, rainTarget, T.rainSoakPerHour, hours);
    }

    if (heat >= T.sweatHeatFloor) {
      const sweatTarget = clamp01(heat * sweatMult(slot));
      if (sweatTarget > wet) {
        wet = approach(wet, sweatTarget, T.sweatSoakPerHour, hours);
      }
    }

    let dryRate = T.dryWornPerHour;
    if (rainTarget > 0.15) dryRate *= T.dryRainPenalty;
    if (sheltered) dryRate *= T.dryShelteredMult;
    const floor = Math.max(
      rainTarget * 0.85,
      heat >= T.sweatHeatFloor ? heat * sweatMult(slot) * 0.5 : 0
    );
    if (wet > floor) {
      wet = approach(wet, floor, dryRate, hours);
    }

    setEnvWet01(item, wet);
  };

  // Outer cloth first so undershirt/underwear see post-tick overlayer wetness.
  for (const slot of GARMENT_WET_SLOTS) {
    if (slot === 'back' || isRainGatedUnderlayer(slot)) continue;
    advanceWornSlot(slot);
  }
  for (const slot of GARMENT_WET_SLOTS) {
    if (!isRainGatedUnderlayer(slot)) continue;
    advanceWornSlot(slot);
  }

  // --- Doffed owned garments: dry only ---
  for (const [id, item] of Object.entries(bank)) {
    if (wornIds.has(id)) continue;
    if (!isGarmentWetSlot(item.slot)) continue;
    if (item.equippedSlot) continue; // worn on someone else — skip
    let wet = readEnvWet01(item);
    if (wet < 0.001) continue;
    let dryRate = T.dryDoffedPerHour;
    if (sheltered) dryRate *= T.dryShelteredMult;
    wet = approach(wet, 0, dryRate, hours);
    setEnvWet01(item, wet);
  }

  const snap = assessWornGarmentWetness(unit, exposure, bank);
  const evaporativeChillF = evaporativeChillFromWorn(snap.wornEnvWet01, {
    sheltered,
    wind01,
  });
  const doffedDamp = listDoffedDamp(unit, bank);

  const bits: string[] = [];
  if (cloakInfo.size) {
    const cw = readEnvWet01(cloakInfo.cloak);
    bits.push(
      `${formatCloakSizeLabel(cloakInfo.size)}${
        cw >= T.cloakSaturateAt ? ' saturated (15% through)' : ' wrapping'
      }`
    );
  }
  if (snap.wornDamp.length) {
    const top = snap.wornDamp
      .slice()
      .sort((a, b) => b.envWet01 - a.envWet01)
      .slice(0, 3)
      .map((d) => `${d.name} ${dampLabel(d.envWet01)}`);
    bits.push(`worn ${top.join(', ')}`);
  }
  if (doffedDamp.length) {
    bits.push(`${doffedDamp.length} doffed damp`);
  }
  if (evaporativeChillF >= 0.4) {
    bits.push(`evap −${evaporativeChillF.toFixed(1)}°F`);
  }

  return {
    itemsById: bank,
    wornEnvWet01: snap.wornEnvWet01,
    evaporativeChillF,
    summary: bits.join(' · '),
    wornDamp: snap.wornDamp,
    doffedDamp,
  };
}

function listDoffedDamp(
  unit: DetailedUnit,
  bank: Record<string, Item>
): GarmentWetAdvanceResult['doffedDamp'] {
  const wornIds = new Set(
    Object.values(unit.equipment).filter((id): id is string => !!id)
  );
  const out: GarmentWetAdvanceResult['doffedDamp'] = [];
  for (const [id, item] of Object.entries(bank)) {
    if (wornIds.has(id)) continue;
    if (!isGarmentWetSlot(item.slot)) continue;
    const wet = readEnvWet01(item);
    if (wet >= T.dampThreshold) {
      out.push({ id, name: item.name, envWet01: wet });
    }
  }
  return out.sort((a, b) => b.envWet01 - a.envWet01);
}

/**
 * Lab / camp action: dry unequipped damp garments by the fire.
 * If itemIds omitted, dries all doffed damp pieces in the bank.
 */
export function dryGarmentsByFire(
  unit: DetailedUnit,
  itemsById: Record<string, Item>,
  opts?: { itemIds?: string[]; hours?: number }
): {
  itemsById: Record<string, Item>;
  dried: Array<{ id: string; name: string; from: number; to: number }>;
  summary: string;
} {
  const bank = { ...itemsById };
  const wornIds = new Set(
    Object.values(unit.equipment).filter((id): id is string => !!id)
  );
  const hours = opts?.hours ?? 1;
  const targets =
    opts?.itemIds ??
    Object.keys(bank).filter((id) => {
      if (wornIds.has(id)) return false;
      const item = bank[id]!;
      return isGarmentWetSlot(item.slot) && readEnvWet01(item) >= T.dampThreshold;
    });

  const dried: Array<{ id: string; name: string; from: number; to: number }> = [];
  for (const id of targets) {
    const item = bank[id];
    if (!item || wornIds.has(id)) continue;
    const from = readEnvWet01(item);
    if (from < 0.001) continue;
    const to = approach(from, 0, T.fireDryRate, hours);
    setEnvWet01(item, to);
    dried.push({ id, name: item.name, from: round3(from), to: round3(to) });
  }

  const summary =
    dried.length === 0
      ? 'nothing damp to dry by the fire'
      : `fire-dry: ${dried
          .map((d) => `${d.name} ${(d.from * 100).toFixed(0)}→${(d.to * 100).toFixed(0)}%`)
          .join(', ')}`;

  return { itemsById: bank, dried, summary };
}

export function describeEnvWet(wet: number): string {
  return dampLabel(clamp01(wet));
}
