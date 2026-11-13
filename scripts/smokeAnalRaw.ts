/**
 * Anal rubbed-raw fatigue → tear smoke.
 *
 * Usage: npx tsx scripts/smokeAnalRaw.ts
 */

import { getDetailedCharacter } from '../src/data/detailedPlaceholderCharacters.ts';
import type { Unit as DetailedUnit } from '../src/types/characters.ts';
import type { LewdChannel } from '../src/utils/lewd/lewdChannels.ts';
import {
  evaluateOrificeComfort,
  type OrificeComfortResult,
} from '../src/utils/lewd/orificeComfort.ts';
import {
  clearAnalSlick,
  ensureAnalBaselineSlick,
  type OrificePlayByFamily,
} from '../src/utils/lewd/orificePlayState.ts';
import { applyAnalTearInjury } from '../src/utils/lewd/analTearInjury.ts';
import { addOrificeSlickLayer } from '../src/utils/lewd/orificeSlick.ts';
import { LEWD_TUNING as T } from '../src/utils/lewd/lewdTuning.ts';

function ch(
  actionId: string,
  targetPart: string,
  intensity = 5,
  actorPart = 'handFinger'
): LewdChannel {
  return { actorPart, actionId, targetPart, intensity };
}

function cloneAmberyl(dry: boolean): DetailedUnit {
  const base = getDetailedCharacter('unit_amberyl');
  if (!base) throw new Error('missing unit_amberyl');
  let u = structuredClone(base) as DetailedUnit;
  if (dry) {
    u = clearAnalSlick(u);
  } else {
    u = ensureAnalBaselineSlick(u);
    // Extra oil-quality film for "well lubricated"
    const layers = addOrificeSlickLayer(
      u.lewdStats.dynamic.orificeSlick?.anus,
      'oilRefined',
      0.55,
      0.85
    );
    u = {
      ...u,
      lewdStats: {
        ...u.lewdStats,
        dynamic: {
          ...u.lewdStats.dynamic,
          orificeSlick: {
            ...u.lewdStats.dynamic.orificeSlick,
            anus: layers,
          },
        },
      },
    };
  }
  return u;
}

function run(
  label: string,
  recipient: DetailedUnit,
  steps: { name: string; channel: LewdChannel; hold?: number; rounds?: number }[],
  startPlay?: OrificePlayByFamily
) {
  console.log(`\n=== ${label} ===`);
  let play: OrificePlayByFamily = { ...(startPlay ?? {}) };
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
        firstEntryHint: (play.anal?.lastSizeRank ?? 0) < 1,
      });
      if (!last) break;
      play = { ...play, [last.family]: last.nextState };
      if (last.analTear) tore = true;
    }
    if (last) {
      console.log(
        `  ${step.name.padEnd(26)} ${last.band.padEnd(10)} dil=${((last.nextState.dilation01 ?? 0) * 100).toFixed(0).padStart(3)}% raw=${((last.nextState.raw01 ?? 0) * 100).toFixed(0).padStart(3)}% stress=${last.rawStress.toFixed(2)} tear=${last.analTear} lube=${(last.lubeComfort01 * 100).toFixed(0)}%`
      );
    }
  }
  return { play, tore, last };
}

console.log('analRaw knobs:', T.orificePlay.analRaw);

// 1) Dry oversized shaft from cold — rapid raw → tear
const dry = run('Dry cold shaft (wipe slick)', cloneAmberyl(true), [
  {
    name: 'dry thrust rectumDeep',
    channel: ch('thrust', 'rectumDeep', 7, 'penisShaft'),
    hold: 3,
    rounds: 8,
  },
]);

// 2) Dry finger even at high intensity — mild raw (anus handles a finger)
const dryFingerHi = run('Dry finger probe intensity 8', cloneAmberyl(true), [
  {
    name: 'dry fingerProbe i8',
    channel: ch('fingerProbe', 'anus', 8),
    hold: 4,
    rounds: 10,
  },
]);

// 3) Same dry finger at low intensity — even milder
const dryFingerLo = run('Dry finger probe intensity 2', cloneAmberyl(true), [
  {
    name: 'dry fingerProbe i2',
    channel: ch('fingerProbe', 'anus', 2),
    hold: 4,
    rounds: 10,
  },
]);

// 4) Dry two-finger high intensity — serious raw above finger
const dryTwoHi = run('Dry two-finger intensity 8', cloneAmberyl(true), [
  {
    name: 'dry twoFingerProbe i8',
    channel: ch('twoFingerProbe', 'anus', 8),
    hold: 4,
    rounds: 8,
  },
]);

// 5) Lubed coaxed ladder — barely raw
const lubed = run('Lubed coaxed ladder', cloneAmberyl(false), [
  { name: 'tease', channel: ch('fingerTrace', 'anus', 3), hold: 1, rounds: 22 },
  { name: '1 finger', channel: ch('fingerProbe', 'anus', 4), hold: 1, rounds: 16 },
  { name: '2 finger', channel: ch('twoFingerProbe', 'anus', 4), hold: 1, rounds: 16 },
  {
    name: 'tip',
    channel: ch('thrust', 'anus', 3, 'penisHead'),
    hold: 1,
    rounds: 18,
  },
  {
    name: 'deep accepting',
    channel: ch('thrust', 'rectumDeep', 4, 'penisShaft'),
    hold: 1,
    rounds: 20,
  },
]);

// 6) Apply tear injury helper once at threshold
const tearUnit = cloneAmberyl(true);
const applied = applyAnalTearInjury(tearUnit, T.orificePlay.analRaw.tearHealthLoss);
console.log(`\n=== Tear injury apply ===\n  ${applied.note}`);

console.log('\n=== ASSERTIONS ===');
const checks: { ok: boolean; msg: string }[] = [];
const dryRaw = dry.play.anal?.raw01 ?? 0;
const lubedRaw = lubed.play.anal?.raw01 ?? 0;
const fingerHiRaw = dryFingerHi.play.anal?.raw01 ?? 0;
const fingerLoRaw = dryFingerLo.play.anal?.raw01 ?? 0;
const twoHiRaw = dryTwoHi.play.anal?.raw01 ?? 0;
checks.push({
  ok: dryRaw >= T.orificePlay.analRaw.tearRawThreshold,
  msg: `dry oversize maxes raw (≥${(T.orificePlay.analRaw.tearRawThreshold * 100).toFixed(0)}%, got ${(dryRaw * 100).toFixed(0)}%)`,
});
checks.push({
  ok: dry.tore,
  msg: `dry oversize tears on forcing beat (tore=${dry.tore})`,
});
checks.push({
  ok: fingerHiRaw < 0.35,
  msg: `dry finger (even i8) stays mild raw (got ${(fingerHiRaw * 100).toFixed(0)}% < 35%)`,
});
checks.push({
  ok: fingerLoRaw < fingerHiRaw * 0.75,
  msg: `low intensity finger raws less than high (${(fingerLoRaw * 100).toFixed(0)}% < ${(fingerHiRaw * 100).toFixed(0)}%)`,
});
checks.push({
  ok: twoHiRaw > fingerHiRaw * 2,
  msg: `dry two-finger i8 raws much harder than finger (${(twoHiRaw * 100).toFixed(0)}% >> ${(fingerHiRaw * 100).toFixed(0)}%)`,
});
checks.push({
  ok: lubedRaw < 0.25,
  msg: `lubed coaxed barely raws (got ${(lubedRaw * 100).toFixed(0)}% < 25%)`,
});
checks.push({
  ok: !lubed.tore,
  msg: `lubed coaxed does not tear (tore=${lubed.tore})`,
});
checks.push({
  ok: applied.healthAfter < 0.9 && applied.unit.combatStats.itemizedHealth.anus.bleed > 0.05,
  msg: `tear injury lowers anus HP + bleed (HP ${(applied.healthAfter * 100).toFixed(0)}% bleed ${(applied.unit.combatStats.itemizedHealth.anus.bleed * 100).toFixed(0)}%)`,
});

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.msg}`);
  if (!c.ok) failed++;
}
console.log(
  failed === 0 ? '\nAll anal-raw smoke checks passed.' : `\n${failed} check(s) failed.`
);
process.exit(failed === 0 ? 0 : 1);
