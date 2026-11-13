/**
 * Vaginal rubbed-raw (forgiving) smoke.
 *
 * Usage: npx tsx scripts/smokeVaginalRaw.ts
 */

import { getDetailedCharacter } from '../src/data/detailedPlaceholderCharacters.ts';
import type { Unit as DetailedUnit } from '../src/types/characters.ts';
import type { LewdChannel } from '../src/utils/lewd/lewdChannels.ts';
import { applyVaginalTearInjury } from '../src/utils/lewd/analTearInjury.ts';
import {
  evaluateOrificeComfort,
  type OrificeComfortResult,
} from '../src/utils/lewd/orificeComfort.ts';
import type { OrificePlayByFamily } from '../src/utils/lewd/orificePlayState.ts';
import {
  addOrificeSlickLayer,
  type OrificeSlickById,
} from '../src/utils/lewd/orificeSlick.ts';
import { LEWD_TUNING as T } from '../src/utils/lewd/lewdTuning.ts';

function ch(
  actionId: string,
  targetPart: string,
  intensity = 5,
  actorPart = 'handFinger'
): LewdChannel {
  return { actorPart, actionId, targetPart, intensity };
}

function clone(opts: { dry: boolean; felt?: number }): DetailedUnit {
  const base = getDetailedCharacter('unit_amberyl');
  if (!base) throw new Error('missing unit_amberyl');
  let u = structuredClone(base) as DetailedUnit;
  const prev = u.lewdStats.dynamic.orificeSlick ?? {};
  let vagina = opts.dry ? [] : undefined;
  if (!opts.dry) {
    vagina = addOrificeSlickLayer(
      undefined,
      'vaginalSecretion',
      0.55,
      0.72
    );
  }
  const slick: OrificeSlickById = {
    ...prev,
    vagina: vagina ?? prev.vagina,
  };
  if (opts.dry) slick.vagina = [];
  u = {
    ...u,
    lewdStats: {
      ...u.lewdStats,
      dynamic: { ...u.lewdStats.dynamic, orificeSlick: slick },
    },
  };
  return u;
}

function run(
  label: string,
  recipient: DetailedUnit,
  steps: { name: string; channel: LewdChannel; hold?: number; rounds?: number }[],
  feltWetness01?: number
) {
  console.log(`\n=== ${label} ===`);
  let play: OrificePlayByFamily = {};
  let tore = false;
  let last: OrificeComfortResult | null = null;
  for (const step of steps) {
    const rounds = step.rounds ?? 1;
    const hold = step.hold ?? 4;
    for (let i = 0; i < rounds; i++) {
      last = evaluateOrificeComfort({
        channel: step.channel,
        recipient,
        orificePlay: play,
        holdSeconds: hold,
        feltWetness01,
      });
      if (!last) break;
      play = { ...play, [last.family]: last.nextState };
      if (last.orificeTear) tore = true;
    }
    if (last) {
      console.log(
        `  ${step.name.padEnd(28)} ${last.band.padEnd(10)} dil=${((last.nextState.dilation01 ?? 0) * 100).toFixed(0).padStart(3)}% raw=${((last.nextState.raw01 ?? 0) * 100).toFixed(0).padStart(3)}% stress=${last.rawStress.toFixed(2)} tear=${last.orificeTear} lube=${(last.lubeComfort01 * 100).toFixed(0)}%`
      );
    }
  }
  return { play, tore, last };
}

console.log('vaginalRaw knobs:', T.orificePlay.vaginalRaw);

const dryForce = run(
  'Dry cold shaft (wiped vagina)',
  clone({ dry: true }),
  [
    {
      name: 'dry thrust vaginaDeep',
      channel: ch('thrust', 'vaginaDeep', 8, 'penisShaft'),
      hold: 3,
      rounds: 10,
    },
  ]
);

const secretionForeplay = run(
  'Secretion + coaxed ladder (foreplay rewarded)',
  clone({ dry: false }),
  [
    { name: 'tease labia', channel: ch('fingerTrace', 'labiaMinora', 3), hold: 1, rounds: 12 },
    { name: '1 finger', channel: ch('fingerProbe', 'vaginaShallow', 4), hold: 1, rounds: 14 },
    { name: '2 finger', channel: ch('twoFingerProbe', 'vaginaShallow', 4), hold: 1, rounds: 14 },
    {
      name: 'tip',
      channel: ch('thrust', 'vaginaShallow', 3, 'penisHead'),
      hold: 1,
      rounds: 16,
    },
    {
      name: 'deep accepting',
      channel: ch('thrust', 'vaginaDeep', 4, 'penisShaft'),
      hold: 1,
      rounds: 18,
    },
  ],
  0.55
);

const dryFinger = run(
  'Dry finger i8 (should stay mild — designed for this)',
  clone({ dry: true }),
  [
    {
      name: 'dry fingerProbe',
      channel: ch('fingerProbe', 'vaginaShallow', 8),
      hold: 4,
      rounds: 10,
    },
  ]
);

const applied = applyVaginalTearInjury(
  clone({ dry: true }),
  T.orificePlay.vaginalRaw.tearHealthLoss
);
console.log(`\n=== Tear injury apply ===\n  ${applied.note}`);

console.log('\n=== ASSERTIONS ===');
const dryRaw = dryForce.play.vagina?.raw01 ?? 0;
const foreRaw = secretionForeplay.play.vagina?.raw01 ?? 0;
const fingerRaw = dryFinger.play.vagina?.raw01 ?? 0;
const checks: { ok: boolean; msg: string }[] = [];
checks.push({
  ok: dryRaw >= T.orificePlay.vaginalRaw.tearRawThreshold,
  msg: `dry forced shaft maxes raw (got ${(dryRaw * 100).toFixed(0)}%)`,
});
checks.push({
  ok: dryForce.tore,
  msg: `dry forced shaft tears groin (tore=${dryForce.tore})`,
});
checks.push({
  ok: foreRaw < 0.2,
  msg: `secretion foreplay barely raws (got ${(foreRaw * 100).toFixed(0)}% < 20%)`,
});
checks.push({
  ok: !secretionForeplay.tore,
  msg: `secretion foreplay does not tear`,
});
checks.push({
  ok: fingerRaw < 0.3,
  msg: `dry finger stays mild (got ${(fingerRaw * 100).toFixed(0)}% < 30%)`,
});
checks.push({
  ok:
    applied.healthAfter < 0.95 &&
    applied.unit.combatStats.itemizedHealth.groin.bleed > 0.04,
  msg: `vaginal tear lowers groin HP + bleed (HP ${(applied.healthAfter * 100).toFixed(0)}% bleed ${(applied.unit.combatStats.itemizedHealth.groin.bleed * 100).toFixed(0)}%)`,
});

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.msg}`);
  if (!c.ok) failed++;
}
console.log(
  failed === 0
    ? '\nAll vaginal-raw smoke checks passed.'
    : `\n${failed} check(s) failed.`
);
process.exit(failed === 0 ? 0 : 1);
