/**
 * Thin fluid-sample scaffold smoke.
 *
 * Usage: npx tsx scripts/smokeFluidSample.ts
 */

import { getDetailedCharacter } from '../src/data/detailedPlaceholderCharacters.ts';
import type { Unit as DetailedUnit } from '../src/types/characters.ts';
import { dischargeOnClimax } from '../src/utils/lewd/fluidDischarge.ts';
import {
  applySubstanceTrace,
  collectFluidFromUnit,
  createEncounterFluidDeposit,
  depositsFromDischarges,
  harvestEncounterDeposit,
  samplePropertyPotency,
  stampFluidProperties,
} from '../src/utils/lewd/fluidSample.ts';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

function cloneUnit(id: string): DetailedUnit {
  const base = getDetailedCharacter(id);
  if (!base) throw new Error(`missing ${id}`);
  return structuredClone(base) as DetailedUnit;
}

let sain = cloneUnit('unit_sain');

sain = applySubstanceTrace(sain, {
  id: 'magResElixir',
  potency01: 1,
  sourceId: 'elixir_mag_res',
  label: 'magical resistance elixir',
  fluidTransfer: { semen: 0.35, blood: 1, sweat: 0.5, urine: 0.7 },
});

const semenProps = stampFluidProperties(sain, 'semen');
const bloodProps = stampFluidProperties(sain, 'blood');
assert(
  semenProps.some((p) => p.id === 'magResElixir'),
  'semen should stamp magResElixir'
);
assert(
  samplePropertyPotency({ properties: semenProps }, 'magResElixir') <
    samplePropertyPotency({ properties: bloodProps }, 'magResElixir'),
  'blood transfer should exceed semen'
);

const discharge = dischargeOnClimax({
  unitId: sain.id,
  sex: 'M',
  climaxCountAfter: 1,
  role: 'proactive',
  site: 'vaginaShallow',
});

const deposits = depositsFromDischarges({
  discharges: [discharge],
  unitsById: { [sain.id]: sain },
  targetParts: ['vaginaShallow'],
});
assert(deposits.length === 1, 'one semen deposit expected');
assert(deposits[0]!.fromId === sain.id, 'deposit keeps donor id');
assert(deposits[0]!.locus === 'vagina', 'vaginal deposit locus');
assert(
  deposits[0]!.properties.some((p) => p.id === 'magResElixir'),
  'deposit carries elixir property'
);

const harvested = harvestEncounterDeposit(deposits, deposits[0]!.id, {
  intoUnit: cloneUnit('unit_amberyl'),
  label: 'Sain semen vial',
});
assert(harvested.sample, 'harvest yields sample');
assert(harvested.deposits.length === 0, 'deposit removed from encounter');
assert(
  (harvested.unit?.lewdStats.dynamic.fluidSamples?.length ?? 0) === 1,
  'sample stored on harvester'
);
assert(harvested.sample!.fromId === 'unit_sain', 'persistent sample keeps origin');

const oral = createEncounterFluidDeposit({
  kind: 'semen',
  fromId: sain.id,
  fromSex: 'M',
  volume01: 0.9,
  unit: sain,
  targetParts: ['mouth'],
});
assert(oral.locus === 'mouth', 'oral target → mouth locus');

let berry = cloneUnit('unit_amberyl');
berry = applySubstanceTrace(berry, {
  id: 'slugAttractant',
  potency01: 0.9,
  sourceId: 'exotic_berry',
  label: 'slug-lure berry',
  fluidTransfer: { sweat: 1, urine: 0.2, blood: 0.1, semen: 0 },
});
const sweatCollect = collectFluidFromUnit(berry, 'sweat', 0.4, {
  label: 'Amberyl sweat',
});
assert(
  sweatCollect.sample.properties.some((p) => p.id === 'slugAttractant'),
  'collected sweat stamps berry attractant'
);
assert(
  stampFluidProperties(berry, 'semen').every((p) => p.id !== 'slugAttractant'),
  'berry blocks semen transfer when fluidTransfer.semen = 0'
);

console.log('smokeFluidSample: ok');
console.log(
  `  semen magRes potency ${samplePropertyPotency(deposits[0]!, 'magResElixir').toFixed(3)} · blood ${samplePropertyPotency({ properties: bloodProps }, 'magResElixir').toFixed(3)}`
);
console.log(
  `  harvest → ${harvested.sample!.label} from ${harvested.sample!.fromId} (${harvested.sample!.properties.map((p) => p.id).join(', ')})`
);
console.log(
  `  sweat collect → slugAttractant ${samplePropertyPotency(sweatCollect.sample, 'slugAttractant').toFixed(3)}`
);
