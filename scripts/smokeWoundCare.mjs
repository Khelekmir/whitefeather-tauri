/**
 * Smoke: natural heal, bandage, vulnerary.
 * Run: npx tsx scripts/smokeWoundCare.mjs
 */
import { getDetailedCharacter } from '../src/data/detailedPlaceholderCharacters.ts';
import { getCombatCastInventory } from '../src/data/starters/combatCastInventory.ts';
import { tickBleed } from '../src/utils/combat/tickBleed.ts';
import {
  applyBandage,
  applyVulnerary,
  clotRatePerMinute,
  healRatePerMinute,
  findOwnedConsumable,
  BANDAGE_TEMPLATE_ID,
  VULNERARY_TEMPLATE_ID,
} from '../src/utils/combat/woundCare.ts';
import { COMBAT_TUNING } from '../src/utils/combat/combatTuning.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const unit = structuredClone(getDetailedCharacter('unit_amberyl'));
const itemsById = structuredClone(getCombatCastInventory('unit_amberyl').items);

const bandages = Object.values(itemsById).filter(
  (i) => i.templateId === BANDAGE_TEMPLATE_ID
).length;
const salves = Object.values(itemsById).filter(
  (i) => i.templateId === VULNERARY_TEMPLATE_ID
).length;
console.log('1 starter care stock:', bandages, 'bandage,', salves, 'vulnerary');
assert(bandages === 2 && salves === 1, 'expected 2 bandages + 1 vulnerary');

const part = unit.combatStats.itemizedHealth.chestLeft;
part.health = 0.5;
part.bleed = 0.5;
const baseHeal = healRatePerMinute(part);
const baseClot = clotRatePerMinute(part);
console.log('2 baseline rates heal/clot:', baseHeal, baseClot);
assert(
  Math.abs(baseHeal - COMBAT_TUNING.woundCare.naturalHealPerMinute) < 1e-9,
  'baseline heal'
);
assert(Math.abs(baseClot - COMBAT_TUNING.clotRatePerMinute) < 1e-9, 'baseline clot');

applyBandage(unit.combatStats.itemizedHealth, 'chestLeft');
const bandHeal = healRatePerMinute(part);
const bandClot = clotRatePerMinute(part);
console.log('3 bandage rates:', bandHeal, bandClot);
assert(
  Math.abs(bandHeal - baseHeal * COMBAT_TUNING.woundCare.bandageHealMult) < 1e-9,
  'bandage heal mult'
);
assert(
  Math.abs(bandClot - baseClot * COMBAT_TUNING.woundCare.bandageClotMult) < 1e-9,
  'bandage clot mult'
);

applyVulnerary(unit.combatStats.itemizedHealth, 'chestLeft');
const bothHeal = healRatePerMinute(part);
const bothClot = clotRatePerMinute(part);
console.log('4 bandage+vulnerary rates:', bothHeal, bothClot);
assert(
  Math.abs(
    bothHeal -
      baseHeal *
        COMBAT_TUNING.woundCare.bandageHealMult *
        COMBAT_TUNING.woundCare.vulneraryHealMult
  ) < 1e-9,
  'stacked heal'
);

const fighter = { unit, itemsById };
const before = part.health;
const tick = tickBleed(fighter, 10);
const after =
  tick.fighter.unit.combatStats.itemizedHealth.chestLeft.health;
console.log('5 after 10 min heal:', before, '→', after);
assert(after > before, 'health should rise');
assert(
  tick.log.some((l) => /Natural heal/i.test(l)),
  'heal log line'
);

// Ruined undressed: no heal
const u2 = structuredClone(getDetailedCharacter('unit_sain'));
const i2 = structuredClone(getCombatCastInventory('unit_sain').items);
u2.combatStats.itemizedHealth.footLeft.health = 0;
u2.combatStats.itemizedHealth.footLeft.bleed = 1;
u2.combatStats.itemizedHealth.footLeft.dressed = false;
const t2 = tickBleed({ unit: u2, itemsById: i2 }, 30);
assert(
  t2.fighter.unit.combatStats.itemizedHealth.footLeft.health === 0,
  'ruined undressed should not heal'
);
console.log('6 ruined undressed stays 0');

u2.combatStats.itemizedHealth.footLeft.dressed = true;
const t3 = tickBleed({ unit: u2, itemsById: i2 }, 30);
assert(
  t3.fighter.unit.combatStats.itemizedHealth.footLeft.health > 0,
  'ruined dressed should slowly heal'
);
console.log(
  '7 ruined dressed after 30m:',
  t3.fighter.unit.combatStats.itemizedHealth.footLeft.health
);

assert(findOwnedConsumable(itemsById, BANDAGE_TEMPLATE_ID), 'bandage still in bank');
console.log('OK');
