/**
 * Soft-cap anal dilation chain smoke.
 *
 * Usage (from repo root):
 *   npx tsx scripts/smokeOrificeSoftCap.ts
 */

import { getDetailedCharacter } from '../src/data/detailedPlaceholderCharacters.ts';
import type { Unit as DetailedUnit } from '../src/types/characters.ts';
import type { LewdChannel } from '../src/utils/lewd/lewdChannels.ts';
import {
  evaluateOrificeComfort,
  type OrificeComfortResult,
} from '../src/utils/lewd/orificeComfort.ts';
import {
  ensureAnalBaselineSlick,
  type OrificePlayByFamily,
} from '../src/utils/lewd/orificePlayState.ts';
import { LEWD_TUNING as T } from '../src/utils/lewd/lewdTuning.ts';

function ch(
  actionId: string,
  targetPart: string,
  intensity = 4,
  actorPart = 'handFinger'
): LewdChannel {
  return { actorPart, actionId, targetPart, intensity };
}

function cloneRecipient(): DetailedUnit {
  const base = getDetailedCharacter('unit_amberyl');
  if (!base) throw new Error('missing unit_amberyl');
  const raw = structuredClone(base) as DetailedUnit;
  return ensureAnalBaselineSlick(raw);
}

function fmt(r: OrificeComfortResult): string {
  return `${r.tier.padEnd(6)} ${r.sizeClass.padEnd(12)} ${r.band.padEnd(10)} dil=${(r.nextState.dilation01 * 100).toFixed(0).padStart(3)}% cap=${(r.softCap01 * 100).toFixed(0).padStart(3)}% open=${r.openCapacity.toFixed(2)} jump=${r.jumpSteps.toFixed(1)} phys=${r.physPerSec.toFixed(2)} settle=${r.settleReliefPerSec.toFixed(2)} sudden=${r.sudden}`;
}

function runSteps(
  label: string,
  steps: { name: string; channel: LewdChannel; hold?: number; rounds?: number }[],
  startPlay?: OrificePlayByFamily
) {
  console.log(`\n=== ${label} ===`);
  let play: OrificePlayByFamily = { ...(startPlay ?? {}) };
  const recipient = cloneRecipient();
  for (const step of steps) {
    const rounds = step.rounds ?? 1;
    const hold = step.hold ?? 8;
    let last: OrificeComfortResult | null = null;
    for (let i = 0; i < rounds; i++) {
      const r = evaluateOrificeComfort({
        channel: step.channel,
        recipient,
        orificePlay: play,
        holdSeconds: hold,
        firstEntryHint:
          (play.anal?.lastSizeRank ?? 0) < 1 &&
          /^(anus|rectum)/i.test(step.channel.targetPart),
      });
      if (!r) {
        console.log(`  ${step.name}: NULL (no orifice eval)`);
        break;
      }
      play = { ...play, [r.family]: r.nextState };
      last = r;
    }
    if (last) {
      console.log(`  ${step.name.padEnd(28)} ${fmt(last)}`);
    }
  }
  return play;
}

const caps = T.orificePlay.dilationSoftCapBySize;
const approach = T.orificePlay.softCapApproachPerSec;
const jumpRate = T.orificePlay.jumpDilationPerSec;

console.log('Soft caps:', caps);
console.log('Capacity breakpoints:', T.orificePlay.capacityAtDilation);
console.log(
  `Rates: softCapApproach=${approach}/s  jumpDilation=${jumpRate}/s  (jump/gentle≈${(jumpRate / approach).toFixed(2)}x)`
);

// 1s Lab-like beats: ~20s tease to fingertip soft cap at 0.014/s.
const gentle = runSteps('Gentle chain (tease→1→2→tip→deep, 1s beats)', [
  { name: 'tease fingerTrace anus', channel: ch('fingerTrace', 'anus', 3), hold: 1, rounds: 22 },
  { name: 'settle tease', channel: ch('fingerTrace', 'anus', 3), hold: 1, rounds: 4 },
  { name: '1 fingerProbe anus', channel: ch('fingerProbe', 'anus', 4), hold: 1, rounds: 16 },
  { name: 'settle 1 finger', channel: ch('fingerProbe', 'anus', 4), hold: 1, rounds: 4 },
  { name: '2 fingerProbe anus', channel: ch('twoFingerProbe', 'anus', 4), hold: 1, rounds: 16 },
  { name: 'settle 2 finger', channel: ch('twoFingerProbe', 'anus', 4), hold: 1, rounds: 4 },
  {
    name: 'penis tip thrust anus',
    channel: ch('thrust', 'anus', 3, 'penisHead'),
    hold: 1,
    rounds: 18,
  },
  {
    name: 'settle tip',
    channel: ch('thrust', 'anus', 3, 'penisHead'),
    hold: 1,
    rounds: 4,
  },
  {
    name: 'deep shaft rectum',
    channel: ch('thrust', 'rectumDeep', 5, 'penisShaft'),
    hold: 1,
    rounds: 18,
  },
]);

const surprise1 = runSteps('Surprise 1-finger cold jump', [
  {
    name: 'cold fingerProbe anus',
    channel: ch('fingerProbe', 'anus', 6),
    rounds: 1,
    hold: 4,
  },
  {
    name: 'continue 1 finger (settle)',
    channel: ch('fingerProbe', 'anus', 4),
    hold: 1,
    rounds: 20,
  },
]);

const surprise2 = runSteps('Surprise 2-finger cold jump', [
  {
    name: 'cold twoFingerProbe anus',
    channel: ch('twoFingerProbe', 'anus', 6),
    rounds: 1,
    hold: 4,
  },
  {
    name: 'continue 2 finger',
    channel: ch('twoFingerProbe', 'anus', 4),
    hold: 1,
    rounds: 20,
  },
]);

const rushedTip = runSteps('Jump tip after only brief tease', [
  { name: 'brief tease (~4s)', channel: ch('fingerTrace', 'anus', 3), hold: 1, rounds: 4 },
  {
    // intensity ≤4 keeps penisHead at tip scale (gentle tip-on-low-intensity)
    name: 'jump tip thrust',
    channel: ch('thrust', 'anus', 4, 'penisHead'),
    rounds: 1,
    hold: 4,
  },
  {
    name: 'continue tip 8s still jumped',
    channel: ch('thrust', 'anus', 3, 'penisHead'),
    hold: 1,
    rounds: 8,
  },
]);

// Mid-stage coaxing sample (first 1s beat from cold)
const coaxSample = evaluateOrificeComfort({
  channel: ch('fingerTrace', 'anus', 3),
  recipient: cloneRecipient(),
  orificePlay: {},
  holdSeconds: 1,
});
console.log(
  `\nCoax sample (cold tease 1s): ${coaxSample ? fmt(coaxSample) : 'NULL'}`
);

// Short prep must not unlock accepting tip insert.
const shortPrepTip = evaluateOrificeComfort({
  channel: ch('thrust', 'anus', 3, 'penisHead'),
  recipient: cloneRecipient(),
  orificePlay: {
    anal: {
      dilation01: 0.28,
      stretchFatigue01: 0,
      lastSizeRank: 1,
    },
  },
  holdSeconds: 4,
});
console.log(
  `Short-prep tip @28% dil: ${shortPrepTip ? fmt(shortPrepTip) : 'NULL'}`
);

const gDil = gentle.anal?.dilation01 ?? 0;
const s1Phys = evaluateOrificeComfort({
  channel: ch('fingerProbe', 'anus', 6),
  recipient: cloneRecipient(),
  orificePlay: {},
  holdSeconds: 4,
  firstEntryHint: true,
});
const s2Phys = evaluateOrificeComfort({
  channel: ch('twoFingerProbe', 'anus', 6),
  recipient: cloneRecipient(),
  orificePlay: {},
  holdSeconds: 4,
  firstEntryHint: true,
});

console.log('\n=== ASSERTIONS ===');
const checks: { ok: boolean; msg: string }[] = [];
checks.push({
  ok: Math.abs(approach - 0.014) < 1e-6,
  msg: `gentle coax rate is ~1/4 prior (0.014/s, got ${approach})`,
});
checks.push({
  ok: jumpRate > approach && jumpRate <= approach * 1.75,
  msg: `rough jump only mildly faster than gentle (${jumpRate}/s ≈ ${(jumpRate / approach).toFixed(2)}x)`,
});
checks.push({
  ok: gDil >= 0.9,
  msg: `sustained gentle chain reaches near-full dilation (got ${(gDil * 100).toFixed(0)}%)`,
});
checks.push({
  ok: !!coaxSample && coaxSample.band === 'coaxing' && coaxSample.physPerSec > 0,
  msg: `cold tease coaxing with mild phys (band=${coaxSample?.band} phys=${coaxSample?.physPerSec.toFixed(2)})`,
});
checks.push({
  ok:
    !!coaxSample &&
    coaxSample.nextState.dilation01 > 0 &&
    coaxSample.nextState.dilation01 < caps.fingertip * 0.55,
  msg: `1s cold tease only nicks dilation (${((coaxSample?.nextState.dilation01 ?? 0) * 100).toFixed(1)}% << ${(caps.fingertip * 100).toFixed(0)}% cap)`,
});
checks.push({
  ok:
    !!shortPrepTip &&
    shortPrepTip.band === 'forcing' &&
    shortPrepTip.jumpSteps > 0,
  msg: `tip after tease-only soft cap stays forcing (band=${shortPrepTip?.band} jump=${shortPrepTip?.jumpSteps})`,
});
checks.push({
  ok: !!s1Phys && s1Phys.band === 'forcing' && s1Phys.jumpSteps > 0,
  msg: `surprise 1-finger is forcing jump (band=${s1Phys?.band} jump=${s1Phys?.jumpSteps})`,
});
checks.push({
  ok:
    !!s2Phys &&
    s2Phys.band === 'forcing' &&
    s2Phys.physPerSec > (s1Phys?.physPerSec ?? 0),
  msg: `surprise 2-finger phys > 1-finger (${s2Phys?.physPerSec.toFixed(2)} > ${s1Phys?.physPerSec.toFixed(2)})`,
});
checks.push({
  ok: !!s1Phys && s1Phys.physPerSec < T.orificePlay.jumpPhysPerSecCap,
  msg: `surprise 1-finger phys under cap (${s1Phys?.physPerSec.toFixed(2)} < ${T.orificePlay.jumpPhysPerSecCap})`,
});
checks.push({
  ok: (surprise1.anal?.dilation01 ?? 0) > 0.15,
  msg: `surprise 1-finger still dilates (${((surprise1.anal?.dilation01 ?? 0) * 100).toFixed(0)}%)`,
});
checks.push({
  ok: (surprise2.anal?.dilation01 ?? 0) > (surprise1.anal?.dilation01 ?? 0),
  msg: `surprise 2 dilates faster than 1 (${((surprise2.anal?.dilation01 ?? 0) * 100).toFixed(0)}% vs ${((surprise1.anal?.dilation01 ?? 0) * 100).toFixed(0)}%)`,
});
checks.push({
  ok: (rushedTip.anal?.dilation01 ?? 0) < caps.penisTip,
  msg: `brief-tease + ~12s tip jump has not soft-capped tip yet (${((rushedTip.anal?.dilation01 ?? 0) * 100).toFixed(0)}% < ${(caps.penisTip * 100).toFixed(0)}%)`,
});

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.msg}`);
  if (!c.ok) failed++;
}
console.log(
  failed === 0
    ? '\nAll soft-cap smoke checks passed.'
    : `\n${failed} check(s) failed.`
);
process.exit(failed === 0 ? 0 : 1);
