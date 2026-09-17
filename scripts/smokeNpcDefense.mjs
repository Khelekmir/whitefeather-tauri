/**
 * Smoke: NPC dodge/parry chances + resolve gate.
 * Run: npx tsx scripts/smokeNpcDefense.mjs
 */
import { getDetailedCharacter } from '../src/data/detailedPlaceholderCharacters.ts';
import { getCombatCastInventory } from '../src/data/starters/combatCastInventory.ts';
import { calcDefenseChances } from '../src/utils/combat/calcDefenseChances.ts';
import { calcHealthPenalty, calcStaminaPenalty } from '../src/utils/combat/penalties.ts';
import { resolveNpcDefense } from '../src/utils/combat/resolveNpcDefense.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function fighter(id) {
  const unit = structuredClone(getDetailedCharacter(id));
  const itemsById = structuredClone(getCombatCastInventory(id).items);
  return { unit, itemsById };
}

const amberyl = fighter('unit_amberyl');
const sain = fighter('unit_sain');

const healthy = calcDefenseChances({
  unit: amberyl.unit,
  itemsById: amberyl.itemsById,
});
console.log(
  '1 Amberyl healthy dodge/parry:',
  healthy.dodge,
  healthy.parry,
  'stamPen',
  healthy.breakdown.staminaPenalty,
  'hpDodge',
  healthy.breakdown.healthPenaltyDodge
);
assert(healthy.dodge > 0.05, 'healthy dodge should be meaningful');
assert(healthy.breakdown.staminaPenalty > 0.95, 'full stam ≈ 1');
assert(healthy.breakdown.healthPenaltyDodge > 0.9, 'healthy hp penalty high');

// Wreck legs → dodge health penalty collapses
for (const p of [
  'footLeft',
  'footRight',
  'kneeLeft',
  'kneeRight',
  'lowerLegLeft',
  'lowerLegRight',
]) {
  amberyl.unit.combatStats.itemizedHealth[p].health = 0;
}
const wrecked = calcDefenseChances({
  unit: amberyl.unit,
  itemsById: amberyl.itemsById,
});
console.log(
  '2 Amberyl wrecked legs dodge:',
  wrecked.dodge,
  'hpDodge',
  wrecked.breakdown.healthPenaltyDodge
);
assert(
  wrecked.breakdown.healthPenaltyDodge < healthy.breakdown.healthPenaltyDodge,
  'leg wreck lowers healthPenalty'
);
assert(wrecked.dodge < healthy.dodge, 'leg wreck lowers dodge %');

// Empty stamina
amberyl.unit.combatStats.base.staminaCurrent = 0;
const noStam = calcDefenseChances({
  unit: amberyl.unit,
  itemsById: amberyl.itemsById,
});
console.log('3 empty stam dodge/parry:', noStam.dodge, noStam.parry, 'stamPen', noStam.breakdown.staminaPenalty);
assert(noStam.breakdown.staminaPenalty < 0.15, 'empty stam low penalty');
assert(noStam.dodge <= wrecked.dodge, 'empty stam should not raise dodge');

// Forced dodge
const a = fighter('unit_sain');
const d = fighter('unit_amberyl');
const dodged = resolveNpcDefense(a, d, { rng: () => 0 }); // always < any positive p
console.log('4 forced dodge:', dodged.outcome, dodged.log[0]);
assert(dodged.outcome === 'dodge', 'rng 0 should dodge if p>0');
assert(
  dodged.defender.unit.combatStats.base.staminaCurrent <
    d.unit.combatStats.base.staminaCurrent,
  'dodge spends stam'
);

// Forced fail both (rng always 1)
const failed = resolveNpcDefense(a, d, { rng: () => 0.999 });
console.log('5 forced fail:', failed.outcome);
assert(failed.outcome === 'none', 'high rng fails defense');

// Health penalty formula spot-check
const hp = calcHealthPenalty(d.unit.combatStats.itemizedHealth, 'dodgeChance');
const stam = calcStaminaPenalty(
  d.unit.combatStats.base.staminaCap,
  d.unit.combatStats.base.staminaCurrent
);
console.log('6 fresh Amberyl hp/stam penalties:', hp, stam);
assert(hp > 0.9 && stam > 0.95, 'fresh penalties near 1');

console.log('OK');
