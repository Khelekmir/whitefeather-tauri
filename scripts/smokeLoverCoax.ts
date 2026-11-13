/**
 * Lover-coax arousal under psych strain.
 *
 * Usage: npx tsx scripts/smokeLoverCoax.ts
 */

import {
  loverCoaxAffinity01,
  loverCoaxGainFloor,
  type BondSnapshot,
} from '../src/utils/lewd/intimacyBond.ts';
import {
  createEncounterArousalState,
  updateEncounterArousal,
  type EncounterArousalState,
} from '../src/utils/lewd/encounterArousal.ts';
import { LEWD_TUNING as T } from '../src/utils/lewd/lewdTuning.ts';

function snap(
  p: Partial<BondSnapshot> &
    Pick<BondSnapshot, 'trust' | 'affection' | 'desire'>
): BondSnapshot {
  return {
    familiarity: 40,
    respect: 50,
    warmth: 0,
    desireHeat: 0,
    hurt: 0,
    irritation: 0,
    suspicion: 0,
    guilt: 0,
    ...p,
  };
}

const PRESETS: Record<string, BondSnapshot> = {
  cold: snap({
    trust: 25,
    affection: 20,
    desire: 5,
    familiarity: 10,
    respect: 40,
  }),
  warm: snap({
    trust: 68,
    affection: 70,
    desire: 28,
    familiarity: 40,
    respect: 55,
    warmth: 35,
    desireHeat: 20,
  }),
  lovers: snap({
    trust: 88,
    affection: 90,
    desire: 78,
    familiarity: 70,
    respect: 70,
    warmth: 55,
    desireHeat: 40,
  }),
};

function baseState(partial: Partial<EncounterArousalState>): EncounterArousalState {
  return {
    ...createEncounterArousalState(),
    ...partial,
    discomfort: Math.max(
      partial.discomfortPhys ?? 0,
      partial.discomfortPsych ?? 0,
      partial.discomfort ?? 0
    ),
  };
}

function runClimb(
  label: string,
  bond: BondSnapshot,
  opts: {
    startPsych: number;
    startPhys: number;
    startArousal: number;
    seconds: number;
    psychPerSec: number;
  }
) {
  let state = baseState({
    arousal: opts.startArousal,
    edge: 10,
    discomfortPsych: opts.startPsych,
    discomfortPhys: opts.startPhys,
  });
  const a0 = state.arousal;
  for (let t = 0; t < opts.seconds; t++) {
    // Soft-unready-style psych fee before integrate (resolveLewdMove seeds the same way).
    // Keep phys pinned low so coax phys gate stays open.
    const psych = Math.min(100, state.discomfortPsych + opts.psychPerSec);
    state = {
      ...state,
      discomfortPsych: psych,
      discomfortPhys: opts.startPhys,
      discomfort: Math.max(opts.startPhys, psych),
    };
    state = updateEncounterArousal(state, {
      psychQuality: 0.85,
      physioQuality: 0.8,
      // High erogenous so softCap is not the limiter — coax vs continuum is.
      erogenous: 0.92,
      deltaT: 1,
      sex: 'F',
      bond,
    });
    // Re-pin phys after integrator decay so the scenario stays “mind strain, body ok”.
    state = {
      ...state,
      discomfortPhys: opts.startPhys,
      discomfort: Math.max(opts.startPhys, state.discomfortPsych),
    };
  }
  const midPsych = opts.startPsych + opts.psychPerSec * Math.floor(opts.seconds / 2);
  const floorMid = loverCoaxGainFloor(bond, midPsych, opts.startPhys);
  console.log(
    `  ${label.padEnd(28)} A ${a0.toFixed(0)}→${state.arousal.toFixed(0)} (Δ${(state.arousal - a0).toFixed(1)}) · psych ${opts.startPsych}→${state.discomfortPsych.toFixed(0)} · phys ${state.discomfortPhys.toFixed(0)} · coaxAff ${loverCoaxAffinity01(bond).toFixed(2)} · floor@mid ${floorMid.toFixed(2)}`
  );
  return { state, a0 };
}

console.log('Lover-coax knobs:', T.bond.loverCoax);
console.log('\n=== Affinity ===');
for (const [k, b] of Object.entries(PRESETS)) {
  console.log(`  ${k}: affinity ${loverCoaxAffinity01(b).toFixed(3)}`);
}

console.log(
  '\n=== Climb through overwhelm (phys 12, start A 22, psych 48 + fee; erogenous-open softCap) ==='
);
const coldClimb = runClimb('cold', PRESETS.cold, {
  startPsych: 48,
  startPhys: 12,
  startArousal: 22,
  seconds: 25,
  psychPerSec: 1.5,
});
const warmClimb = runClimb('warm', PRESETS.warm, {
  startPsych: 48,
  startPhys: 12,
  startArousal: 22,
  seconds: 25,
  psychPerSec: 1.5,
});
const loversClimb = runClimb('lovers', PRESETS.lovers, {
  startPsych: 48,
  startPhys: 12,
  startArousal: 22,
  seconds: 25,
  psychPerSec: 1.5,
});

console.log('\n=== High phys blocks coax (phys 55) ===');
const loversHighPhys = runClimb('lovers phys55', PRESETS.lovers, {
  startPsych: 48,
  startPhys: 55,
  startArousal: 22,
  seconds: 25,
  psychPerSec: 1.5,
});

console.log('\n=== Psych hard-cap drains (start psych near hard, A 60) ===');
const hard = T.encounter.discomfortPsychHardCap;
let breakState = baseState({
  arousal: 60,
  edge: 20,
  discomfortPsych: hard - 2,
  discomfortPhys: 10,
});
const aBreak0 = breakState.arousal;
for (let t = 0; t < 8; t++) {
  breakState = {
    ...breakState,
    discomfortPsych: Math.min(100, Math.max(hard, breakState.discomfortPsych + 1)),
    discomfortPhys: 10,
    discomfort: Math.max(10, Math.min(100, Math.max(hard, breakState.discomfortPsych + 1))),
  };
  breakState = updateEncounterArousal(breakState, {
    psychQuality: 0.9,
    physioQuality: 0.85,
    erogenous: 0.75,
    deltaT: 1,
    sex: 'F',
    bond: PRESETS.lovers,
  });
}
console.log(
  `  lovers at/over break: A ${aBreak0.toFixed(0)}→${breakState.arousal.toFixed(0)} · psych ${breakState.discomfortPsych.toFixed(0)}`
);

console.log('\n=== ASSERTIONS ===');
const checks: { ok: boolean; msg: string }[] = [];
const coldDelta = coldClimb.state.arousal - coldClimb.a0;
const warmDelta = warmClimb.state.arousal - warmClimb.a0;
const loversDelta = loversClimb.state.arousal - loversClimb.a0;
const highPhysDelta = loversHighPhys.state.arousal - loversHighPhys.a0;
const floor70 = loverCoaxGainFloor(PRESETS.lovers, 70, 12);
const floorHard = loverCoaxGainFloor(PRESETS.lovers, hard, 12);

checks.push({
  ok: loverCoaxAffinity01(PRESETS.lovers) > loverCoaxAffinity01(PRESETS.warm),
  msg: `lovers affinity > warm (${loverCoaxAffinity01(PRESETS.lovers).toFixed(2)} > ${loverCoaxAffinity01(PRESETS.warm).toFixed(2)})`,
});
checks.push({
  ok: loverCoaxAffinity01(PRESETS.warm) > loverCoaxAffinity01(PRESETS.cold),
  msg: `warm affinity > cold (${loverCoaxAffinity01(PRESETS.warm).toFixed(2)} > ${loverCoaxAffinity01(PRESETS.cold).toFixed(2)})`,
});
checks.push({
  ok: loversDelta > 8,
  msg: `lovers arousal climbs under rising psych (Δ${loversDelta.toFixed(1)})`,
});
checks.push({
  ok: loversDelta > warmDelta + 3 && warmDelta > coldDelta + 2,
  msg: `lovers Δ > warm Δ > cold (Δ ${loversDelta.toFixed(1)} > ${warmDelta.toFixed(1)} > ${coldDelta.toFixed(1)})`,
});
checks.push({
  ok: highPhysDelta < loversDelta * 0.45,
  msg: `phys≥50 cuts coax climb (Δ${highPhysDelta.toFixed(1)} << lovers ${loversDelta.toFixed(1)})`,
});
checks.push({
  ok: coldDelta < 6,
  msg: `cold barely climbs / stalls into overwhelm (Δ${coldDelta.toFixed(1)})`,
});
checks.push({
  ok: breakState.arousal < aBreak0 - 4,
  msg: `psych hard-cap drains arousal (${aBreak0.toFixed(0)}→${breakState.arousal.toFixed(0)})`,
});
checks.push({
  ok: floor70 > 0.15 && floorHard <= 1e-6,
  msg: `coax floor alive at psych70, zero at hard-cap (${floor70.toFixed(2)} → ${floorHard.toFixed(2)})`,
});

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.msg}`);
  if (!c.ok) failed++;
}
console.log(
  failed === 0
    ? '\nAll lover-coax smoke checks passed.'
    : `\n${failed} check(s) failed.`
);
process.exit(failed === 0 ? 0 : 1);
