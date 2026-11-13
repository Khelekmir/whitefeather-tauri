/**
 * Phase 2 act lubricant deposits smoke.
 *
 * Usage: npx tsx scripts/smokeActDeposits.ts
 */

import { getDetailedCharacter } from '../src/data/detailedPlaceholderCharacters.ts';
import type { Unit as DetailedUnit } from '../src/types/characters.ts';
import {
  applyOrificeOil,
  applySalivaDepositsFromChannels,
} from '../src/utils/lewd/actLubricantDeposit.ts';
import { evaluateOrificeComfort } from '../src/utils/lewd/orificeComfort.ts';
import {
  clearAnalSlick,
  ensureAnalBaselineSlick,
} from '../src/utils/lewd/orificePlayState.ts';
import { blendOrificeSlick } from '../src/utils/lewd/orificeSlick.ts';
import { LEWD_TUNING as T } from '../src/utils/lewd/lewdTuning.ts';

function clone(dry: boolean): DetailedUnit {
  const base = getDetailedCharacter('unit_amberyl');
  if (!base) throw new Error('missing unit_amberyl');
  let u = structuredClone(base) as DetailedUnit;
  u = dry ? clearAnalSlick(u) : ensureAnalBaselineSlick(u);
  return u;
}

console.log('actDeposits:', T.actDeposits);

const dry = clone(true);
const before = blendOrificeSlick(dry.lewdStats.dynamic.orificeSlick?.anus);
console.log(
  `\nDry wipe baseline: wet=${(before.wet01 * 100).toFixed(0)}% q=${(before.quality01 * 100).toFixed(0)}`
);

let spitUnit = dry;
let afterLick = before;
let afterProbe = before;
for (let i = 0; i < 2; i++) {
  const rimmed = applySalivaDepositsFromChannels(
    spitUnit,
    [
      {
        actorPart: 'tongue',
        actionId: 'lick',
        targetPart: 'anus',
        intensity: 5,
      },
    ],
    8
  );
  spitUnit = rimmed.unit;
  afterLick = blendOrificeSlick(spitUnit.lewdStats.dynamic.orificeSlick?.anus);
  console.log(
    `Lick ${i + 1}: ${rimmed.note} · wet=${(afterLick.wet01 * 100).toFixed(0)}% q=${(afterLick.quality01 * 100).toFixed(0)}`
  );
}
for (let i = 0; i < 2; i++) {
  const probed = applySalivaDepositsFromChannels(
    spitUnit,
    [
      {
        actorPart: 'tongue',
        actionId: 'tongueProbe',
        targetPart: 'anus',
        intensity: 6,
      },
    ],
    8
  );
  spitUnit = probed.unit;
  afterProbe = blendOrificeSlick(spitUnit.lewdStats.dynamic.orificeSlick?.anus);
  console.log(
    `Probe ${i + 1}: ${probed.note} · wet=${(afterProbe.wet01 * 100).toFixed(0)}% q=${(afterProbe.quality01 * 100).toFixed(0)}`
  );
}

// Comfort: dry shaft on wiped anus = dryRefuse; after saliva may still refuse
// if wet×quality under threshold — oil should clear it.
const dryRefuse = evaluateOrificeComfort({
  channel: {
    actorPart: 'penisShaft',
    actionId: 'thrust',
    targetPart: 'rectumDeep',
    intensity: 5,
  },
  recipient: clone(true),
  orificePlay: { anal: { dilation01: 0.7, stretchFatigue01: 0, raw01: 0, lastSizeRank: 5 } },
  holdSeconds: 4,
});
console.log(
  `\nDry wiped + dilated thrust: band=${dryRefuse?.band} lube=${((dryRefuse?.lubeComfort01 ?? 0) * 100).toFixed(0)}%`
);

const oiled = applyOrificeOil(clone(true), 'anus', 'oilRefined');
const oiledComfort = evaluateOrificeComfort({
  channel: {
    actorPart: 'penisShaft',
    actionId: 'thrust',
    targetPart: 'rectumDeep',
    intensity: 4,
  },
  recipient: oiled.unit,
  orificePlay: { anal: { dilation01: 0.7, stretchFatigue01: 0, raw01: 0, lastSizeRank: 5 } },
  holdSeconds: 4,
});
console.log(
  `Oiled refined + dilated thrust: ${oiled.note} · band=${oiledComfort?.band} lube=${((oiledComfort?.lubeComfort01 ?? 0) * 100).toFixed(0)}%`
);

const spitComfort = evaluateOrificeComfort({
  channel: {
    actorPart: 'penisHead',
    actionId: 'thrust',
    targetPart: 'anus',
    intensity: 3,
  },
  recipient: spitUnit,
  orificePlay: {
    anal: { dilation01: 0.65, stretchFatigue01: 0, raw01: 0, lastSizeRank: 5 },
  },
  holdSeconds: 4,
});
console.log(
  `Saliva-prepped tip thrust: band=${spitComfort?.band} lube=${((spitComfort?.lubeComfort01 ?? 0) * 100).toFixed(0)}% (need ≥${(T.orificePlay.analDryThreshold * 100).toFixed(0)}%)`
);

// No saliva on finger probe
const fingerOnly = applySalivaDepositsFromChannels(
  clone(true),
  [
    {
      actorPart: 'handFinger',
      actionId: 'fingerProbe',
      targetPart: 'anus',
      intensity: 5,
    },
  ],
  8
);
console.log(`Finger probe deposit note: ${fingerOnly.note ?? '(none)'}`);

console.log('\n=== ASSERTIONS ===');
const checks: { ok: boolean; msg: string }[] = [];
checks.push({
  ok: afterLick.wet01 > before.wet01 + 0.05,
  msg: `lick deposits saliva (wet ${(before.wet01 * 100).toFixed(0)}%→${(afterLick.wet01 * 100).toFixed(0)}%)`,
});
checks.push({
  ok: afterProbe.wet01 > afterLick.wet01,
  msg: `tongueProbe adds more saliva (${(afterLick.wet01 * 100).toFixed(0)}%→${(afterProbe.wet01 * 100).toFixed(0)}%)`,
});
checks.push({
  ok: dryRefuse?.band === 'dryRefuse',
  msg: `wiped dry insert still dryRefuse (${dryRefuse?.band})`,
});
checks.push({
  ok: oiledComfort?.band !== 'dryRefuse' && (oiledComfort?.lubeComfort01 ?? 0) > T.orificePlay.analDryThreshold,
  msg: `refined oil clears dry refuse (band=${oiledComfort?.band} lube=${((oiledComfort?.lubeComfort01 ?? 0) * 100).toFixed(0)}%)`,
});
checks.push({
  ok: spitComfort?.band !== 'dryRefuse',
  msg: `saliva-prepped tip is not dryRefuse (${spitComfort?.band})`,
});
checks.push({
  ok: fingerOnly.note == null,
  msg: `finger probe does not deposit saliva`,
});

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.msg}`);
  if (!c.ok) failed++;
}
console.log(
  failed === 0
    ? '\nAll act-deposit smoke checks passed.'
    : `\n${failed} check(s) failed.`
);
process.exit(failed === 0 ? 0 : 1);
