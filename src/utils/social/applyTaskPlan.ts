/**
 * Apply progressive task plan slices and completion mutations to lab state.
 */

import {
  BODY_PARTS,
  formatBodyPartLabel,
  type Unit as DetailedUnit,
} from '../../types/characters';
import type { Item } from '../../types/items';
import {
  COMBAT_CAST_INVENTORIES,
  DETAILED_ITEM_BANK,
  getDetailedItem,
} from '../../data/starters/combatCastInventory';
import {
  unequipSlots,
  UNDRESS_ORDER_TORSO,
  type GearCtx,
} from '../items/equipGear';
import {
  applyBandage,
  applyVulnerary,
  findOwnedConsumable,
  listCarePriorityParts,
  VULNERARY_TEMPLATE_ID,
} from '../combat/woundCare';
import { batheClearSkinSoil, launderUnderwear } from '../lewd/fluidSoil';
import { scaleShortTermDeltaForMood } from './moodStReceptivity';
import {
  ensureBidirectional,
  nudgeLongTerm,
  nudgeShortTerm,
  type RelationshipGraph,
} from './relationshipState';
import type {
  AssignmentProgressEvent,
  TaskAssignment,
  TaskCompletionMutation,
  TaskEffectBundle,
  TaskEffectPlan,
} from './taskAssignmentClock';
import { progressAssignments } from './taskAssignmentClock';

function ownedItemsSlice(unitId: string): Record<string, Item> {
  const out: Record<string, Item> = {};
  for (const [id, item] of Object.entries(DETAILED_ITEM_BANK)) {
    if (item.ownerId === unitId) out[id] = item;
  }
  return out;
}

function deleteFromSharedBanks(itemId: string): void {
  delete DETAILED_ITEM_BANK[itemId];
  for (const kit of Object.values(COMBAT_CAST_INVENTORIES)) {
    delete kit.items[itemId];
  }
}

function gearCtxFromUnit(unit: DetailedUnit): GearCtx {
  const itemsById: Record<string, Item> = {};
  for (const id of Object.values(unit.equipment)) {
    if (!id) continue;
    const item = getDetailedItem(id);
    if (item) itemsById[id] = item;
  }
  return { unit, itemsById };
}

function peelTorso(unit: DetailedUnit): { unit: DetailedUnit; note: string | null } {
  const next: DetailedUnit = {
    ...unit,
    equipment: { ...unit.equipment },
  };
  const { unequipped } = unequipSlots(gearCtxFromUnit(next), UNDRESS_ORDER_TORSO);
  if (unequipped.length === 0) return { unit: next, note: null };
  return {
    unit: next,
    note: `${next.name} peels for bath: ${unequipped.map((i) => i.name).join(', ')}`,
  };
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function applyPressureDelta(
  unit: DetailedUnit,
  id: string,
  delta: number
): DetailedUnit {
  if (delta === 0) return unit;
  if (id === 'lust') {
    const from = unit.lewdStats.dynamic.lust ?? 0;
    return {
      ...unit,
      lewdStats: {
        ...unit.lewdStats,
        dynamic: {
          ...unit.lewdStats.dynamic,
          lust: clamp100(from + delta),
        },
      },
    };
  }
  const dyn = unit.socialStats.dynamic;
  const from = typeof dyn[id as keyof typeof dyn] === 'number'
    ? (dyn[id as keyof typeof dyn] as number)
    : 0;
  return {
    ...unit,
    socialStats: {
      ...unit.socialStats,
      dynamic: { ...dyn, [id]: clamp100(from + delta) },
    },
  };
}

export interface TaskClockWorldState {
  unitsById: Record<string, DetailedUnit>;
  relationships: RelationshipGraph;
}

export interface ApplyBundleResult {
  state: TaskClockWorldState;
  log: string[];
  flags: string[];
}

function applyBundle(
  state: TaskClockWorldState,
  bundle: TaskEffectBundle,
  round = true
): ApplyBundleResult {
  let relationships = state.relationships;
  const unitsById = { ...state.unitsById };
  const log: string[] = [];
  const flags: string[] = [];

  const roundDelta = (n: number) =>
    round ? Math.round(n * 1000) / 1000 : n;

  for (const d of bundle.pressure) {
    const u = unitsById[d.unitId];
    if (!u) continue;
    const delta = roundDelta(d.delta);
    if (Math.abs(delta) < 1e-6) continue;
    unitsById[d.unitId] = applyPressureDelta(u, d.id, delta);
  }

  for (const d of bundle.shortTerm) {
    const from = unitsById[d.fromId];
    const to = unitsById[d.toId];
    if (!from || !to) continue;
    // Writer mood × thin stress/belonging overlay scales ST only.
    const delta = roundDelta(
      scaleShortTermDeltaForMood(from, d.id, d.delta)
    );
    if (Math.abs(delta) < 1e-6) continue;
    relationships = ensureBidirectional(relationships, from, to);
    relationships = nudgeShortTerm(relationships, from, to, d.id, delta);
  }

  for (const d of bundle.longTerm) {
    const from = unitsById[d.fromId];
    const to = unitsById[d.toId];
    if (!from || !to) continue;
    const delta = roundDelta(d.delta);
    if (Math.abs(delta) < 1e-6) continue;
    relationships = ensureBidirectional(relationships, from, to);
    relationships = nudgeLongTerm(relationships, from, to, d.id, delta);
  }

  return { state: { unitsById, relationships }, log, flags };
}

function runTendWounds(
  healer: DetailedUnit,
  patient: DetailedUnit
): { patient: DetailedUnit; log: string[]; flags: string[] } {
  const itemizedClone = { ...patient.combatStats.itemizedHealth };
  for (const part of BODY_PARTS) {
    itemizedClone[part] = { ...patient.combatStats.itemizedHealth[part] };
  }
  const working: DetailedUnit = {
    ...patient,
    combatStats: {
      ...patient.combatStats,
      itemizedHealth: itemizedClone,
    },
  };
  const itemized = working.combatStats.itemizedHealth;
  const priority = listCarePriorityParts(itemized, 2);
  const dressed: string[] = [];
  for (const part of priority) {
    const r = applyBandage(itemized, part);
    if (r.ok && !r.already) dressed.push(formatBodyPartLabel(part));
    else if (r.ok && r.already) dressed.push(`${formatBodyPartLabel(part)} (already)`);
  }
  let vulneraryNote = '';
  const flags: string[] = [];
  if (priority.length > 0) {
    const bag = ownedItemsSlice(healer.id);
    const salve = findOwnedConsumable(bag, VULNERARY_TEMPLATE_ID);
    if (salve) {
      const top = priority[0]!;
      const vr = applyVulnerary(itemized, top);
      if (vr.ok) {
        deleteFromSharedBanks(salve.id);
        vulneraryNote = ` · vulnerary on ${formatBodyPartLabel(top)} (consumed)`;
        flags.push('used_vulnerary');
      }
    }
  }
  if (dressed.length > 0) flags.push('dressed_wounds');
  const careBit =
    priority.length === 0
      ? 'no open wounds to dress'
      : `dressed ${dressed.join(', ')}${vulneraryNote}`;
  return {
    patient: working,
    log: [`${healer.name} tends ${patient.name}'s wounds — ${careBit}.`],
    flags,
  };
}

function applyMutation(
  state: TaskClockWorldState,
  mut: TaskCompletionMutation
): ApplyBundleResult {
  const unitsById = { ...state.unitsById };
  const log: string[] = [];
  const flags: string[] = [];

  switch (mut.type) {
    case 'launderUnderwear': {
      const u = unitsById[mut.unitId];
      if (!u) break;
      unitsById[mut.unitId] = launderUnderwear(u);
      log.push(`${u.name} finishes laundry.`);
      break;
    }
    case 'batheClearSkin': {
      let u = unitsById[mut.unitId];
      if (!u) break;
      if (mut.peelTorso) {
        const peeled = peelTorso(u);
        u = peeled.unit;
        if (peeled.note) log.push(peeled.note);
      }
      u = batheClearSkinSoil(u);
      unitsById[mut.unitId] = u;
      log.push(`${u.name} finishes bathing — skin soil cleared.`);
      break;
    }
    case 'tendWounds': {
      const healer = unitsById[mut.healerId];
      const patient = unitsById[mut.patientId];
      if (!healer || !patient) break;
      const tended = runTendWounds(healer, patient);
      unitsById[mut.patientId] = tended.patient;
      log.push(...tended.log);
      flags.push(...tended.flags);
      break;
    }
    case 'none':
      break;
  }

  return {
    state: { unitsById, relationships: state.relationships },
    log,
    flags,
  };
}

function applyCompletion(
  state: TaskClockWorldState,
  completion: TaskEffectPlan['completion']
): ApplyBundleResult {
  let cur = state;
  const log: string[] = [];
  const flags: string[] = [...completion.flags];

  for (const mut of completion.mutations) {
    const r = applyMutation(cur, mut);
    cur = r.state;
    log.push(...r.log);
    flags.push(...r.flags);
  }

  const deltas = applyBundle(cur, {
    pressure: completion.pressure,
    shortTerm: completion.shortTerm,
    longTerm: completion.longTerm,
  });
  cur = deltas.state;
  log.push(...deltas.log);

  return { state: cur, log, flags };
}

export interface ProgressTaskBoardResult {
  board: TaskAssignment[];
  state: TaskClockWorldState;
  log: string[];
  flags: string[];
  events: AssignmentProgressEvent[];
}

/**
 * Advance assignment board by passMinutes and apply continuous / completion effects.
 * Call after (or before) world Pass Time physio — preferred order: task apply, then ST drift.
 */
export function progressTaskBoard(
  board: TaskAssignment[],
  state: TaskClockWorldState,
  passMinutes: number
): ProgressTaskBoardResult {
  const progressed = progressAssignments(board, passMinutes);
  let cur = state;
  const log: string[] = [...progressed.log];
  const flags: string[] = [];

  for (const ev of progressed.events) {
    const cont = applyBundle(cur, ev.continuousSlice);
    cur = cont.state;
    log.push(...cont.log);
    if (ev.completed && ev.completion) {
      const done = applyCompletion(cur, ev.completion);
      cur = done.state;
      log.push(...done.log);
      flags.push(...done.flags);
    }
  }

  return {
    board: progressed.board,
    state: cur,
    log,
    flags,
    events: progressed.events,
  };
}
