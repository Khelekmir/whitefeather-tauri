/**
 * Smoke: equip / unequip / barrier / bathe peel / discard.
 * Run: npx tsx scripts/smokeEquipGear.mjs
 */
import { getDetailedCharacter, listDetailedCharacters } from '../src/data/detailedPlaceholderCharacters.ts';
import { getCombatCastInventory } from '../src/data/starters/combatCastInventory.ts';
import {
  equipItem,
  unequipSlots,
  discardEquipped,
  listUnequippedOwned,
  UNDRESS_ORDER_TORSO,
} from '../src/utils/items/equipGear.ts';
import { clothingBarrierForLewdTarget } from '../src/utils/lewd/clothingAccess.ts';
import { resolveSocialTask } from '../src/utils/social/resolveSocialTask.ts';
import { buildCastRelationshipGraph } from '../src/data/social/castRelationshipSeeds.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const unit = structuredClone(getDetailedCharacter('unit_amberyl'));
const kit = getCombatCastInventory('unit_amberyl');
const itemsById = structuredClone(kit.items);
const ctx = { unit, itemsById };

const nippleBefore = clothingBarrierForLewdTarget(
  unit,
  itemsById,
  'nipple',
  'over',
  { applyDisplace: false }
);
console.log(
  '1 nipple soft barrier clothed:',
  (nippleBefore.softBarrier01 * 100).toFixed(0) + '%',
  'layers',
  nippleBefore.layers.map((l) => l.slot).join('+') || 'none'
);
assert(nippleBefore.softBarrier01 > 0.1, 'expected clothed nipple barrier');

const peel = unequipSlots(ctx, UNDRESS_ORDER_TORSO);
console.log(
  '2 peeled torso:',
  peel.unequipped.map((i) => i.name).join(', ')
);
assert(peel.unequipped.length >= 2, 'expected shirt+undershirt (or more) peeled');

const nippleAfter = clothingBarrierForLewdTarget(
  unit,
  itemsById,
  'nipple',
  'over',
  { applyDisplace: false }
);
console.log(
  '3 nipple after peel:',
  (nippleAfter.softBarrier01 * 100).toFixed(0) + '%',
  'skinClear',
  nippleAfter.skinClear,
  'layers',
  nippleAfter.layers.length
);
assert(nippleAfter.softBarrier01 < nippleBefore.softBarrier01, 'barrier should drop after peel');
assert(nippleAfter.skinClear, 'nipple should be skin-clear after torso peel');

const shirt = listUnequippedOwned(ctx).find((i) => i.slot === 'shirt');
assert(shirt, 'shirt should be unequipped-owned');
const eq = equipItem(ctx, shirt.id);
assert(eq.ok, 're-equip shirt failed');
console.log('4 re-equip shirt:', eq.item.name, '→', eq.item.equippedSlot);

const nippleRe = clothingBarrierForLewdTarget(
  unit,
  itemsById,
  'nipple',
  'over',
  { applyDisplace: false }
);
console.log(
  '5 nipple after re-equip:',
  (nippleRe.softBarrier01 * 100).toFixed(0) + '%',
  'layers',
  nippleRe.layers.map((l) => l.slot).join('+')
);
assert(nippleRe.softBarrier01 > 0, 'barrier should return with shirt');

const sain = structuredClone(getDetailedCharacter('unit_sain'));
const sainKit = structuredClone(getCombatCastInventory('unit_sain').items);
const chestId = sain.equipment.chest;
sainKit[chestId].durability = 0;
const beforeOwned = Object.keys(sainKit).length;
const d = discardEquipped({ unit: sain, itemsById: sainKit }, 'chest');
assert(d.ok, 'discard failed');
assert(sain.equipment.chest === null, 'chest slot should be empty');
assert(!(chestId in sainKit), 'item should be deleted from bank');
console.log(
  '6 discard chest:',
  d.item.name,
  'owned',
  beforeOwned,
  '→',
  Object.keys(sainKit).length
);

const primary = structuredClone(getDetailedCharacter('unit_amberyl'));
assert(primary.equipment.shirt, 'amberyl starts with shirt');
const rel = buildCastRelationshipGraph(listDetailedCharacters());
const result = resolveSocialTask({
  taskId: 'bathe',
  primary,
  relationships: rel,
});
assert(result.primary.equipment.shirt === null, 'bathe should peel shirt');
assert(result.primary.equipment.undershirt === null, 'bathe should peel undershirt');
assert(result.effects.flags.includes('peeled_torso'), 'flag peeled_torso');
assert(result.effects.flags.includes('bathed'), 'flag bathed');
console.log('7 bathe peel ok · flags', result.effects.flags.join(','));
console.log('   ', result.log[0]);
console.log('OK');
