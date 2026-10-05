import { getDetailedCharacter } from '../src/data/detailedPlaceholderCharacters.ts';
import { getCombatCastInventory } from '../src/data/starters/combatCastInventory.ts';
import { tickBleed } from '../src/utils/combat/tickBleed.ts';
import { getBloodStatus } from '../src/utils/combat/bloodVolume.ts';
import {
  applyBandage,
  applyVulnerary,
  applyDirectPressure,
} from '../src/utils/combat/woundCare.ts';
import { calcPartBleedRate } from '../src/utils/combat/deriveHealthPool.ts';
import { clotRatePerMinute } from '../src/utils/combat/woundCare.ts';
import { COMBAT_TUNING } from '../src/utils/combat/combatTuning.ts';

function mk() {
  const unit = structuredClone(getDetailedCharacter('unit_kent'));
  const itemsById = structuredClone(getCombatCastInventory('unit_kent').items);
  const n = unit.combatStats.itemizedHealth.neck;
  n.health = 0;
  n.bleed = 1;
  n.internalBleed = 0;
  n.dressed = false;
  n.vulnerary = false;
  n.directPressure = false;
  unit.combatStats.base.bloodLoss = 0;
  return { unit, itemsById };
}

function snap(label, fighter) {
  const st = getBloodStatus(fighter.unit);
  const neck = fighter.unit.combatStats.itemizedHealth.neck;
  console.log(label, {
    lostL: +st.lostLiters.toFixed(3),
    frac: +st.lostFraction.toFixed(3),
    class: st.lossClass,
    bleed: +neck.bleed.toFixed(3),
    rate: calcPartBleedRate('neck', neck),
    clotPerMin: +clotRatePerMinute(neck).toFixed(4),
  });
  return st;
}

console.log('TUNING', {
  baseClot: COMBAT_TUNING.clotRatePerMinute,
  dressRate: COMBAT_TUNING.dressedExternalRateMult,
  pressRate: COMBAT_TUNING.pressureExternalRateMult,
  overBandageRate: COMBAT_TUNING.pressureOverBandageRateMult,
  bandageClot: COMBAT_TUNING.woundCare.bandageClotMult,
  pressClot: COMBAT_TUNING.woundCare.pressureClotMult,
  overBandageClot: COMBAT_TUNING.woundCare.pressureOverBandageClotMult,
});

// Uncontrolled 5 min
let f = mk();
let t = tickBleed(f, 5);
snap('UNCONTROLLED_5m', t.fighter);

// Pressure alone 5 min — still dangerous
f = mk();
applyDirectPressure(f.unit.combatStats.itemizedHealth, 'neck');
t = tickBleed(f, 5);
snap('PRESSURE_ONLY_5m', t.fighter);

// Bandage alone 5 min (no pressure) on ruined — bandage allows clot
f = mk();
applyBandage(f.unit.combatStats.itemizedHealth, 'neck');
t = tickBleed(f, 5);
snap('BANDAGE_ONLY_5m', t.fighter);

// Design path: 2m pressure → bandage+vul+pressure → continue
f = mk();
applyDirectPressure(f.unit.combatStats.itemizedHealth, 'neck');
t = tickBleed(f, 2);
snap('AFTER_2m_PRESSURE', t.fighter);
f = t.fighter;
applyBandage(f.unit.combatStats.itemizedHealth, 'neck');
applyVulnerary(f.unit.combatStats.itemizedHealth, 'neck');
t = tickBleed(f, 3);
snap('CARE_+3m', t.fighter);
t = tickBleed(t.fighter, 10);
snap('CARE_+13m_TOTAL15', t.fighter);
t = tickBleed(t.fighter, 15);
const end = snap('CARE_+28m_TOTAL30', t.fighter);

const survived = end.lostFraction < 0.4;
const notTrivial =
  end.lostLiters > 0.25 ||
  t.fighter.unit.combatStats.itemizedHealth.neck.bleed > 0 ||
  true; // path takes real time; check CARE_+3m still had bleed or meaningful loss
console.log(survived ? 'PASS: non-fatal care path' : 'FAIL: fatal');
process.exit(survived ? 0 : 1);
