/**
 * Smoke: gather_firewood / set_up_camp / strike_camp / scout_path handlers.
 *
 * Usage: npx tsx scripts/smokeSocialCampChores.ts
 */

import { getDetailedCharacter } from '../src/data/detailedPlaceholderCharacters.ts';
import type { Unit as DetailedUnit } from '../src/types/characters.ts';
import { ensureBidirectional } from '../src/utils/social/relationshipState.ts';
import { resolveSocialTask } from '../src/utils/social/resolveSocialTask.ts';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

function clone(id: string): DetailedUnit {
  const u = getDetailedCharacter(id);
  if (!u) throw new Error(`missing ${id}`);
  return structuredClone(u) as DetailedUnit;
}

function energy(u: DetailedUnit): number {
  return u.socialStats.dynamic.energy ?? 0;
}

function stress(u: DetailedUnit): number {
  return u.socialStats.dynamic.stress ?? 0;
}

let primary = clone('unit_amberyl');
let partner = clone('unit_sain');
let graph = ensureBidirectional({}, primary, partner);

const soloWood = resolveSocialTask({
  taskId: 'gather_firewood',
  primary,
  partner: null,
  relationships: graph,
});
assert(soloWood.effects.flags.includes('gathered_firewood'), 'solo wood flag');
assert(!soloWood.effects.flags.includes('stub'), 'solo wood not stub');
assert(
  energy(soloWood.primary) < energy(primary),
  'solo wood spends energy'
);
assert(
  soloWood.effects.shortTerm.length === 0,
  'solo wood has no ST edges'
);

primary = soloWood.primary;
graph = soloWood.relationships;

const pairWood = resolveSocialTask({
  taskId: 'gather_firewood',
  primary,
  partner,
  relationships: graph,
});
assert(pairWood.effects.flags.includes('gathered_firewood'), 'pair wood flag');
assert(
  pairWood.effects.shortTerm.some((e) => e.id === 'warmth'),
  'pair wood warmth'
);
assert(
  pairWood.effects.longTerm.some((e) => e.id === 'familiarity'),
  'pair wood familiarity'
);
assert(pairWood.partner != null, 'pair wood returns partner');
assert(
  energy(pairWood.partner!) < energy(partner),
  'partner spends energy on wood'
);

primary = pairWood.primary;
partner = pairWood.partner!;
graph = pairWood.relationships;
const energyBeforeCamp = energy(primary);
const stressBeforeCamp = stress(primary);

const setCamp = resolveSocialTask({
  taskId: 'set_up_camp',
  primary,
  partner,
  relationships: graph,
});
assert(setCamp.effects.flags.includes('camp_set_up'), 'set camp flag');
assert(!setCamp.effects.flags.includes('stub'), 'set camp not stub');
assert(energy(setCamp.primary) < energyBeforeCamp, 'set camp spends energy');
assert(stress(setCamp.primary) < stressBeforeCamp, 'set camp eases stress');
assert(
  setCamp.effects.shortTerm.some((e) => e.id === 'warmth'),
  'set camp warmth'
);

primary = setCamp.primary;
partner = setCamp.partner!;
graph = setCamp.relationships;
const stressBeforeStrike = stress(primary);

const noPartner = resolveSocialTask({
  taskId: 'strike_camp',
  primary,
  partner: null,
  relationships: graph,
});
assert(
  noPartner.log.some((l) => /partner/i.test(l)),
  'strike camp needs partner'
);
assert(!noPartner.effects.flags.includes('camp_struck'), 'no strike without partner');

const strike = resolveSocialTask({
  taskId: 'strike_camp',
  primary,
  partner,
  relationships: graph,
});
assert(strike.effects.flags.includes('camp_struck'), 'strike flag');
assert(stress(strike.primary) > stressBeforeStrike, 'strike adds pack-out stress');
assert(
  strike.effects.longTerm.some((e) => e.id === 'familiarity'),
  'strike familiarity'
);

primary = strike.primary;
partner = strike.partner!;
graph = strike.relationships;
const stressBeforeScout = stress(primary);

const soloScout = resolveSocialTask({
  taskId: 'scout_path',
  primary,
  partner: null,
  relationships: graph,
});
assert(soloScout.effects.flags.includes('scouted_path'), 'solo scout flag');
assert(soloScout.effects.flags.includes('map_intel'), 'solo scout map intel');
assert(!soloScout.effects.flags.includes('stub'), 'solo scout not stub');
assert(stress(soloScout.primary) > stressBeforeScout, 'solo scout hazard stress');

primary = soloScout.primary;
graph = soloScout.relationships;

const pairScout = resolveSocialTask({
  taskId: 'scout_path',
  primary,
  partner,
  relationships: graph,
});
assert(pairScout.effects.flags.includes('map_intel'), 'pair scout map intel');
assert(
  pairScout.effects.longTerm.some((e) => e.id === 'trust'),
  'pair scout trust'
);
assert(
  pairScout.effects.shortTerm.some(
    (e) => e.id === 'admiration' && e.toId === primary.id
  ),
  'partner admires scout'
);

console.log('smokeSocialCampChores: ok');
console.log(`  ${soloWood.log[0]}`);
console.log(`  ${pairWood.log[0]}`);
console.log(`  ${setCamp.log[0]}`);
console.log(`  ${strike.log[0]}`);
console.log(`  ${soloScout.log[0]}`);
console.log(`  ${pairScout.log[0]}`);
