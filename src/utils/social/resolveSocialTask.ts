import {
  getSocialTaskTemplate,
  type SocialTaskTemplate,
} from '../../data/social/socialLabScaffold';
import type {
  LongTermRelationshipId,
  ShortTermRelationshipId,
} from '../../data/social/relationships';
import type { PersonalizedPressureId } from '../../data/social/durablePressures';
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
import {
  batheClearSkinSoil,
  deriveSoilCues,
  launderUnderwear,
} from '../lewd/fluidSoil';
import {
  ensureBidirectional,
  nudgeLongTerm,
  nudgeShortTerm,
  sexualDesireAllowed,
  type RelationshipGraph,
} from './relationshipState';

/** Shared-bank slice owned by a unit (references live instances). */
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

/** Tunable magnitudes — adjust here without hunting handlers. */
export const SOCIAL_TASK_TUNING = {
  laundry: {
    gratitudeToWasher: 14,
    warmthToWashee: 8,
  },
  bathe: {
    shameRelief: 4,
  },
  batheTogether: {
    warmth: 16,
    desireHeat: 10,
  },
  shareWatch: {
    warmth: 14,
    familiarity: 2,
    desireHeat: 6,
    energyCost: 6,
  },
  cookMeal: {
    soloStressRelief: 4,
    soloPride: 5,
    soloBelonging: 4,
    cookEnergyCost: 8,
    gratitudeToCook: 12,
    warmthShared: 8,
  },
  tendWounds: {
    warmthHealerToPatient: 10,
    gratitudePatientToHealer: 18,
    admirationPatientToHealer: 8,
    patientStressRelief: 10,
  },
  stub: {
    warmth: 12,
    familiarity: 2,
  },
} as const;

export interface SocialTaskInput {
  taskId: string;
  primary: DetailedUnit;
  partner?: DetailedUnit | null;
  relationships: RelationshipGraph;
}

export interface SocialTaskResult {
  primary: DetailedUnit;
  partner: DetailedUnit | null;
  relationships: RelationshipGraph;
  log: string[];
  effects: {
    pressure: { unitId: string; id: PersonalizedPressureId; delta: number }[];
    shortTerm: {
      fromId: string;
      toId: string;
      id: ShortTermRelationshipId;
      delta: number;
    }[];
    longTerm: {
      fromId: string;
      toId: string;
      id: LongTermRelationshipId;
      delta: number;
    }[];
    flags: string[];
  };
  template: SocialTaskTemplate | null;
}

type Ctx = {
  primary: DetailedUnit;
  partner: DetailedUnit | null;
  relationships: RelationshipGraph;
  log: string[];
  effects: SocialTaskResult['effects'];
};

function emptyEffects(): SocialTaskResult['effects'] {
  return { pressure: [], shortTerm: [], longTerm: [], flags: [] };
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function nudgePressure(
  ctx: Ctx,
  unit: DetailedUnit,
  id: PersonalizedPressureId,
  delta: number
): DetailedUnit {
  if (delta === 0) return unit;
  ctx.effects.pressure.push({ unitId: unit.id, id, delta });

  if (id === 'lust') {
    const from = unit.lewdStats.dynamic.lust ?? 0;
    const to = clamp100(from + delta);
    return {
      ...unit,
      lewdStats: {
        ...unit.lewdStats,
        dynamic: { ...unit.lewdStats.dynamic, lust: to },
      },
    };
  }

  const dyn = unit.socialStats.dynamic;
  const from = typeof dyn[id] === 'number' ? (dyn[id] as number) : 0;
  const to = clamp100(from + delta);
  return {
    ...unit,
    socialStats: {
      ...unit.socialStats,
      dynamic: { ...dyn, [id]: to },
    },
  };
}

function writeST(
  ctx: Ctx,
  from: DetailedUnit,
  to: DetailedUnit,
  id: ShortTermRelationshipId,
  delta: number
): void {
  if (delta === 0) return;
  ctx.relationships = ensureBidirectional(ctx.relationships, from, to);
  ctx.relationships = nudgeShortTerm(ctx.relationships, from, to, id, delta);
  ctx.effects.shortTerm.push({
    fromId: from.id,
    toId: to.id,
    id,
    delta,
  });
}

function writeLT(
  ctx: Ctx,
  from: DetailedUnit,
  to: DetailedUnit,
  id: LongTermRelationshipId,
  delta: number
): void {
  if (delta === 0) return;
  ctx.relationships = ensureBidirectional(ctx.relationships, from, to);
  ctx.relationships = nudgeLongTerm(ctx.relationships, from, to, id, delta);
  ctx.effects.longTerm.push({
    fromId: from.id,
    toId: to.id,
    id,
    delta,
  });
}

function needPartner(ctx: Ctx, taskLabel: string): boolean {
  if (ctx.partner) return true;
  ctx.log.push(`Needs a partner for “${taskLabel}” — pick one in the lab.`);
  return false;
}

/** Build GearCtx from unit loadout + shared starter bank (lab pattern). */
function gearCtxFromUnit(unit: DetailedUnit): GearCtx {
  const itemsById: Record<string, Item> = {};
  for (const id of Object.values(unit.equipment)) {
    if (!id) continue;
    const item = getDetailedItem(id);
    if (item) itemsById[id] = item;
  }
  return { unit, itemsById };
}

/** Peel outer→inner torso layers before bathing; returns unit with updated equipment. */
function peelTorsoForBath(ctx: Ctx, unit: DetailedUnit): DetailedUnit {
  const next: DetailedUnit = {
    ...unit,
    equipment: { ...unit.equipment },
  };
  const { unequipped } = unequipSlots(
    gearCtxFromUnit(next),
    UNDRESS_ORDER_TORSO
  );
  if (unequipped.length > 0) {
    ctx.effects.flags.push('peeled_torso');
    ctx.log.push(
      `${next.name} peels for bath: ${unequipped.map((i) => i.name).join(', ')}`
    );
  }
  return next;
}

function handleLaundry(ctx: Ctx): void {
  const T = SOCIAL_TASK_TUNING.laundry;
  const before = deriveSoilCues(ctx.primary);
  ctx.primary = launderUnderwear(ctx.primary);
  const after = deriveSoilCues(ctx.primary);
  ctx.effects.flags.push('laundered');
  ctx.log.push(
    `${ctx.primary.name} laundry: ${before.summary} → ${after.summary}`
  );
  if (ctx.partner) {
    writeST(ctx, ctx.primary, ctx.partner, 'gratitude', T.gratitudeToWasher);
    writeST(ctx, ctx.partner, ctx.primary, 'warmth', T.warmthToWashee);
    ctx.log.push(
      `${ctx.primary.name}→${ctx.partner.name}: gratitude/warmth from shared wash.`
    );
  }
}

function handleBathe(ctx: Ctx): void {
  const T = SOCIAL_TASK_TUNING.bathe;
  ctx.primary = peelTorsoForBath(ctx, ctx.primary);
  ctx.primary = batheClearSkinSoil(ctx.primary);
  ctx.primary = nudgePressure(ctx, ctx.primary, 'shame', -T.shameRelief);
  ctx.effects.flags.push('bathed');
  ctx.log.push(
    `${ctx.primary.name} bathes — skin soil cleared · ${deriveSoilCues(ctx.primary).summary}`
  );
}

function handleBatheTogether(ctx: Ctx, template: SocialTaskTemplate): void {
  if (!needPartner(ctx, template.label)) return;
  const partner = ctx.partner!;
  const T = SOCIAL_TASK_TUNING.batheTogether;

  ctx.primary = peelTorsoForBath(ctx, ctx.primary);
  ctx.primary = batheClearSkinSoil(ctx.primary);
  ctx.primary = nudgePressure(ctx, ctx.primary, 'shame', -SOCIAL_TASK_TUNING.bathe.shameRelief);
  ctx.partner = peelTorsoForBath(ctx, partner);
  ctx.partner = batheClearSkinSoil(ctx.partner);
  ctx.partner = nudgePressure(
    ctx,
    ctx.partner,
    'shame',
    -SOCIAL_TASK_TUNING.bathe.shameRelief
  );
  ctx.effects.flags.push('bathed', 'bathed_together');

  writeST(ctx, ctx.primary, ctx.partner, 'warmth', T.warmth);
  writeST(ctx, ctx.partner, ctx.primary, 'warmth', T.warmth);
  if (sexualDesireAllowed(ctx.primary, ctx.partner)) {
    writeST(ctx, ctx.primary, ctx.partner, 'desireHeat', T.desireHeat);
  }
  if (sexualDesireAllowed(ctx.partner, ctx.primary)) {
    writeST(ctx, ctx.partner, ctx.primary, 'desireHeat', T.desireHeat);
  }

  ctx.log.push(
    `${ctx.primary.name} bathes — skin soil cleared · ${deriveSoilCues(ctx.primary).summary}`
  );
  ctx.log.push(
    `Bathe together: ${ctx.primary.name} + ${ctx.partner.name} warmth up; desireHeat if attraction allows.`
  );
}

function handleShareWatch(ctx: Ctx, template: SocialTaskTemplate): void {
  if (!needPartner(ctx, template.label)) return;
  const partner = ctx.partner!;
  const T = SOCIAL_TASK_TUNING.shareWatch;

  writeST(ctx, ctx.primary, partner, 'warmth', T.warmth);
  writeST(ctx, partner, ctx.primary, 'warmth', T.warmth);
  writeLT(ctx, ctx.primary, partner, 'familiarity', T.familiarity);
  writeLT(ctx, partner, ctx.primary, 'familiarity', T.familiarity);
  if (sexualDesireAllowed(ctx.primary, partner)) {
    writeST(ctx, ctx.primary, partner, 'desireHeat', T.desireHeat);
  }
  if (sexualDesireAllowed(partner, ctx.primary)) {
    writeST(ctx, partner, ctx.primary, 'desireHeat', T.desireHeat);
  }
  ctx.primary = nudgePressure(ctx, ctx.primary, 'energy', -T.energyCost);
  ctx.partner = nudgePressure(ctx, partner, 'energy', -T.energyCost);
  ctx.effects.flags.push('shared_watch');
  ctx.log.push(
    `${ctx.primary.name} + ${partner.name} share watch — warmth, familiarity; soft desireHeat if attracted; energy −${T.energyCost}.`
  );
}

function handleCookMeal(ctx: Ctx): void {
  const T = SOCIAL_TASK_TUNING.cookMeal;
  ctx.primary = nudgePressure(ctx, ctx.primary, 'energy', -T.cookEnergyCost);
  ctx.effects.flags.push('cooked_meal');

  if (!ctx.partner) {
    ctx.primary = nudgePressure(ctx, ctx.primary, 'stress', -T.soloStressRelief);
    ctx.primary = nudgePressure(ctx, ctx.primary, 'pride', T.soloPride);
    ctx.primary = nudgePressure(ctx, ctx.primary, 'belonging', T.soloBelonging);
    ctx.log.push(
      `${ctx.primary.name} cooks a meal alone — pride/belonging up, stress down, energy −${T.cookEnergyCost}.`
    );
    return;
  }

  const partner = ctx.partner;
  // Both ate: gratitude toward cook (primary), mutual warmth.
  writeST(ctx, partner, ctx.primary, 'gratitude', T.gratitudeToCook);
  writeST(ctx, ctx.primary, partner, 'warmth', T.warmthShared);
  writeST(ctx, partner, ctx.primary, 'warmth', T.warmthShared);
  ctx.partner = nudgePressure(ctx, partner, 'stress', -T.soloStressRelief);
  ctx.primary = nudgePressure(ctx, ctx.primary, 'pride', T.soloPride);
  ctx.log.push(
    `${ctx.primary.name} cooks for ${partner.name} — gratitude to cook, shared warmth; cook energy −${T.cookEnergyCost}.`
  );
}

function handleTendWounds(ctx: Ctx, template: SocialTaskTemplate): void {
  if (!needPartner(ctx, template.label)) return;
  const healer = ctx.primary;
  const srcPatient = ctx.partner!;
  const itemizedClone = { ...srcPatient.combatStats.itemizedHealth };
  for (const part of BODY_PARTS) {
    itemizedClone[part] = { ...srcPatient.combatStats.itemizedHealth[part] };
  }
  const patient: DetailedUnit = {
    ...srcPatient,
    combatStats: {
      ...srcPatient.combatStats,
      itemizedHealth: itemizedClone,
    },
  };
  const T = SOCIAL_TASK_TUNING.tendWounds;
  const itemized = patient.combatStats.itemizedHealth;
  const priority = listCarePriorityParts(itemized, 2);
  const dressed: string[] = [];

  for (const part of priority) {
    const r = applyBandage(itemized, part);
    if (r.ok && !r.already) dressed.push(formatBodyPartLabel(part));
    else if (r.ok && r.already) dressed.push(`${formatBodyPartLabel(part)} (already)`);
  }

  let vulneraryNote = '';
  if (priority.length > 0) {
    const bag = ownedItemsSlice(healer.id);
    const salve = findOwnedConsumable(bag, VULNERARY_TEMPLATE_ID);
    if (salve) {
      const top = priority[0]!;
      const vr = applyVulnerary(itemized, top);
      if (vr.ok) {
        deleteFromSharedBanks(salve.id);
        vulneraryNote = ` · vulnerary on ${formatBodyPartLabel(top)} (consumed)`;
        ctx.effects.flags.push('used_vulnerary');
      }
    }
  }

  writeST(ctx, healer, patient, 'warmth', T.warmthHealerToPatient);
  writeST(ctx, patient, healer, 'gratitude', T.gratitudePatientToHealer);
  writeST(ctx, patient, healer, 'admiration', T.admirationPatientToHealer);
  ctx.partner = nudgePressure(ctx, patient, 'stress', -T.patientStressRelief);
  ctx.effects.flags.push('tended_wounds');
  if (dressed.length > 0) ctx.effects.flags.push('dressed_wounds');

  const careBit =
    priority.length === 0
      ? 'no open wounds to dress'
      : `dressed ${dressed.join(', ')}${vulneraryNote}`;
  ctx.log.push(
    `${healer.name} tends ${patient.name}'s wounds — ${careBit}; patient stress −${T.patientStressRelief}, gratitude/admiration toward healer.`
  );
}

function handleStub(ctx: Ctx, template: SocialTaskTemplate): void {
  const T = SOCIAL_TASK_TUNING.stub;
  const names = ctx.partner
    ? `${ctx.primary.name} + ${ctx.partner.name}`
    : ctx.primary.name;
  ctx.log.push(
    `Stub: “${template.label}” with ${names}. Effects TBD (${template.stubEffects.join(', ')}).`
  );
  ctx.effects.flags.push('stub');
  if (ctx.partner) {
    writeST(ctx, ctx.primary, ctx.partner, 'warmth', T.warmth);
    writeST(ctx, ctx.partner, ctx.primary, 'warmth', T.warmth);
    writeLT(ctx, ctx.primary, ctx.partner, 'familiarity', T.familiarity);
    writeLT(ctx, ctx.partner, ctx.primary, 'familiarity', T.familiarity);
    ctx.log.push(
      `Dev nudge: ${ctx.primary.name}↔${ctx.partner.name} warmth +${T.warmth} (both ways), familiarity +${T.familiarity}.`
    );
  }
}

/**
 * Resolve one social task against primary (+ optional partner) and relationship graph.
 * Pure-ish: returns new unit/graph snapshots; caller applies to lab state.
 */
export function resolveSocialTask(input: SocialTaskInput): SocialTaskResult {
  const template = getSocialTaskTemplate(input.taskId) ?? null;
  const ctx: Ctx = {
    primary: input.primary,
    partner: input.partner ?? null,
    relationships: input.relationships,
    log: [],
    effects: emptyEffects(),
  };

  if (!template) {
    ctx.log.push(`Unknown social task: ${input.taskId}`);
    return {
      primary: ctx.primary,
      partner: ctx.partner,
      relationships: ctx.relationships,
      log: ctx.log,
      effects: ctx.effects,
      template: null,
    };
  }

  switch (template.id) {
    case 'do_laundry':
      handleLaundry(ctx);
      break;
    case 'bathe':
      handleBathe(ctx);
      break;
    case 'bathe_together':
      handleBatheTogether(ctx, template);
      break;
    case 'share_watch':
      handleShareWatch(ctx, template);
      break;
    case 'cook_meal':
      handleCookMeal(ctx);
      break;
    case 'tend_wounds':
      handleTendWounds(ctx, template);
      break;
    default:
      handleStub(ctx, template);
      break;
  }

  return {
    primary: ctx.primary,
    partner: ctx.partner,
    relationships: ctx.relationships,
    log: ctx.log,
    effects: ctx.effects,
    template,
  };
}
