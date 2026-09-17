import type { Unit as DetailedUnit } from '../../types/characters';
import {
  EQUIPMENT_SLOTS,
  type Item,
  type ItemSlot,
} from '../../types/items';

/**
 * Shared equip / unequip for status, social, combat, and lewd.
 * Owned bank = itemsById (equipped + unequipped-owned). No separate bag in v1.
 */

export type GearCtx = {
  unit: DetailedUnit;
  itemsById: Record<string, Item>;
};

export type GearFailReason =
  | 'missing_item'
  | 'wrong_slot'
  | 'slot_empty'
  | 'sex_restricted'
  | 'already_equipped';

export type GearOk = { ok: true; item: Item; previous: Item | null };
export type GearFail = {
  ok: false;
  reason: GearFailReason;
  message: string;
};
export type GearResult = GearOk | GearFail;

/** Outer → inner peel for bathing / intimacy undress. */
export const UNDRESS_ORDER_TORSO: ItemSlot[] = [
  'back',
  'chest',
  'shirt',
  'undershirt',
];

export const UNDRESS_ORDER_BOTTOM: ItemSlot[] = [
  'leg',
  'waist',
  'underwear',
];

function fail(reason: GearFailReason, message: string): GearFail {
  return { ok: false, reason, message };
}

function slotsCompatible(itemSlot: ItemSlot, target: ItemSlot): boolean {
  if (itemSlot === target) return true;
  const rings = new Set(['ring1', 'ring2']);
  const trinkets = new Set(['trinket1', 'trinket2']);
  if (rings.has(itemSlot) && rings.has(target)) return true;
  if (trinkets.has(itemSlot) && trinkets.has(target)) return true;
  return false;
}

function sexAllows(unit: DetailedUnit, item: Item): boolean {
  const sex = item.flags?.sex;
  if (!sex || sex === 'any') return true;
  if (sex === 'female' && unit.sex === 'F') return true;
  if (sex === 'male' && unit.sex === 'M') return true;
  return false;
}

function clearGarmentState(item: Item): void {
  if (!item.garmentState) return;
  item.garmentState = { displace: {}, macros: {} };
}

function detachFromOtherSlots(ctx: GearCtx, itemId: string, keep?: ItemSlot): void {
  for (const slot of EQUIPMENT_SLOTS) {
    if (keep && slot === keep) continue;
    if (ctx.unit.equipment[slot] === itemId) {
      ctx.unit.equipment[slot] = null;
    }
  }
}

/**
 * Clear a worn slot. Item remains owned (`itemsById`) with equippedSlot null.
 * Clears garment displace so re-equip starts seated.
 */
export function unequipSlot(ctx: GearCtx, slot: ItemSlot): GearResult {
  const id = ctx.unit.equipment[slot];
  if (!id) return fail('slot_empty', `Nothing equipped in ${slot}.`);
  const item = ctx.itemsById[id];
  if (!item) {
    ctx.unit.equipment[slot] = null;
    return fail('missing_item', `Missing item ${id} for ${slot}; slot cleared.`);
  }
  ctx.unit.equipment[slot] = null;
  item.equippedSlot = null;
  clearGarmentState(item);
  return { ok: true, item, previous: null };
}

/** Unequip several slots in order; skips empty. */
export function unequipSlots(
  ctx: GearCtx,
  slots: ItemSlot[]
): { results: GearResult[]; unequipped: Item[] } {
  const results: GearResult[] = [];
  const unequipped: Item[] = [];
  for (const slot of slots) {
    if (!ctx.unit.equipment[slot]) continue;
    const r = unequipSlot(ctx, slot);
    results.push(r);
    if (r.ok) unequipped.push(r.item);
  }
  return { results, unequipped };
}

/**
 * Equip an owned item into a slot (default: item.slot).
 * Occupant of that slot becomes unequipped-owned.
 */
export function equipItem(
  ctx: GearCtx,
  itemId: string,
  slot?: ItemSlot
): GearResult {
  const item = ctx.itemsById[itemId];
  if (!item) return fail('missing_item', `Unknown item ${itemId}.`);
  if (!sexAllows(ctx.unit, item)) {
    return fail(
      'sex_restricted',
      `${item.name} is not wearable by this character.`
    );
  }
  const target = slot ?? item.slot;
  if (!slotsCompatible(item.slot, target)) {
    return fail(
      'wrong_slot',
      `${item.name} (${item.slot}) cannot go in ${target}.`
    );
  }
  if (ctx.unit.equipment[target] === itemId) {
    return fail('already_equipped', `${item.name} is already in ${target}.`);
  }

  // If worn elsewhere, detach first.
  detachFromOtherSlots(ctx, itemId, target);

  let previous: Item | null = null;
  const prevId = ctx.unit.equipment[target];
  if (prevId && prevId !== itemId) {
    const prev = unequipSlot(ctx, target);
    if (prev.ok) previous = prev.item;
  }

  ctx.unit.equipment[target] = itemId;
  item.equippedSlot = target;
  return { ok: true, item, previous };
}

/**
 * Unequip then remove from the owned bank (destroy / abandon on the field).
 */
export function discardEquipped(ctx: GearCtx, slot: ItemSlot): GearResult {
  const r = unequipSlot(ctx, slot);
  if (!r.ok) return r;
  delete ctx.itemsById[r.item.id];
  return r;
}

export function listEquipped(
  ctx: GearCtx
): { slot: ItemSlot; item: Item }[] {
  const out: { slot: ItemSlot; item: Item }[] = [];
  for (const slot of EQUIPMENT_SLOTS) {
    const id = ctx.unit.equipment[slot];
    if (!id) continue;
    const item = ctx.itemsById[id];
    if (item) out.push({ slot, item });
  }
  return out;
}

export function listUnequippedOwned(ctx: GearCtx): Item[] {
  const worn = new Set(
    Object.values(ctx.unit.equipment).filter((id): id is string => !!id)
  );
  return Object.values(ctx.itemsById).filter((it) => !worn.has(it.id));
}
