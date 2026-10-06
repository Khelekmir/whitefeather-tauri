/**
 * Headless arousal/edge balance matrix.
 *
 * Runs authored Lewd Lab preloads through resolveLewdChannels for pair × bond
 * presets and prints climb timings (no UI / no Playwright required).
 *
 * Usage:
 *   npx tsx scripts/simLewdArousalEdgeMatrix.ts
 *   npx tsx scripts/simLewdArousalEdgeMatrix.ts --chain
 *   npx tsx scripts/simLewdArousalEdgeMatrix.ts --pair sain-amberyl --bond warm
 *
 * Flags:
 *   --chain     Run shoulder → kiss → groin in sequence (shared meters)
 *   --pair ID   Only one pair (default: all)
 *   --bond ID   cold | warm | lovers (default: all)
 *   --json      Machine-readable summary lines
 */

import { getDetailedCharacter } from '../src/data/detailedPlaceholderCharacters.ts';
import { getCombatCastInventory } from '../src/data/starters/combatCastInventory.ts';
import type { Unit as DetailedUnit } from '../src/types/characters.ts';
import type { Item } from '../src/types/items.ts';
import {
  createEncounterArousalState,
  type EncounterArousalState,
} from '../src/utils/lewd/encounterArousal.ts';
import { expandPreload } from '../src/utils/lewd/expandPreload.ts';
import type { LewdChannel } from '../src/utils/lewd/lewdChannels.ts';
import { resolveLewdChannels } from '../src/utils/lewd/resolveLewdMove.ts';
import {
  ensureBidirectional,
  setLongTerm,
  setShortTerm,
  type RelationshipGraph,
} from '../src/utils/social/relationshipState.ts';
import type {
  LongTermRelationshipId,
  ShortTermRelationshipId,
} from '../src/data/social/relationships.ts';

type BondKind = 'cold' | 'warm' | 'lovers';

interface PairDef {
  id: string;
  proactiveId: string;
  recipientId: string;
}

interface ScenarioDef {
  id: string;
  preloadId: string;
  variantId: string;
}

const PAIRS: PairDef[] = [
  { id: 'sain-amberyl', proactiveId: 'unit_sain', recipientId: 'unit_amberyl' },
  { id: 'dorcas-natalie', proactiveId: 'unit_dorcas', recipientId: 'unit_natalie' },
  { id: 'kent-lyn', proactiveId: 'unit_kent', recipientId: 'unit_lyn' },
];

const BOND_PRESETS: Record<
  BondKind,
  {
    trust: number;
    affection: number;
    desire: number;
    familiarity: number;
    respect: number;
    warmth: number;
    desireHeat: number;
    hurt: number;
    suspicion: number;
  }
> = {
  cold: {
    trust: 25,
    affection: 20,
    desire: 5,
    familiarity: 10,
    respect: 40,
    warmth: 0,
    desireHeat: 0,
    hurt: 0,
    suspicion: 15,
  },
  warm: {
    trust: 68,
    affection: 70,
    desire: 28,
    familiarity: 50,
    respect: 62,
    warmth: 35,
    desireHeat: 12,
    hurt: 0,
    suspicion: 0,
  },
  lovers: {
    trust: 88,
    affection: 90,
    desire: 78,
    familiarity: 80,
    respect: 78,
    warmth: 55,
    desireHeat: 48,
    hurt: 0,
    suspicion: 0,
  },
};

const SCENARIOS: ScenarioDef[] = [
  { id: 'shoulder_firm', preloadId: 'give_shoulder_rub', variantId: 'firm' },
  { id: 'kiss_warm', preloadId: 'light_kiss_fondle', variantId: 'warm' },
  { id: 'groin_firm', preloadId: 'groin_fondle_aside', variantId: 'firm' },
];

const CHAIN: ScenarioDef[] = [
  { id: 'shoulder_firm', preloadId: 'give_shoulder_rub', variantId: 'firm' },
  { id: 'kiss_warm', preloadId: 'light_kiss_fondle', variantId: 'warm' },
  { id: 'groin_firm', preloadId: 'groin_fondle_aside', variantId: 'firm' },
];

function cloneUnit(id: string): DetailedUnit {
  const u = getDetailedCharacter(id);
  if (!u) throw new Error(`Unknown unit ${id}`);
  return structuredClone(u);
}

function cloneItems(id: string): Record<string, Item> {
  return structuredClone(getCombatCastInventory(id as never).items);
}

function applyBondPreset(
  graph: RelationshipGraph,
  a: DetailedUnit,
  b: DetailedUnit,
  kind: BondKind
): RelationshipGraph {
  const p = BOND_PRESETS[kind];
  let g = ensureBidirectional(graph, a, b);
  const lt: [LongTermRelationshipId, number][] = [
    ['trust', p.trust],
    ['affection', p.affection],
    ['desire', p.desire],
    ['familiarity', p.familiarity],
    ['respect', p.respect],
  ];
  const st: [ShortTermRelationshipId, number][] = [
    ['warmth', p.warmth],
    ['desireHeat', p.desireHeat],
    ['hurt', p.hurt],
    ['suspicion', p.suspicion],
  ];
  for (const [id, v] of lt) {
    g = setLongTerm(g, a, b, id, v);
    g = setLongTerm(g, b, a, id, v);
  }
  for (const [id, v] of st) {
    g = setShortTerm(g, a, b, id, v);
    g = setShortTerm(g, b, a, id, v);
  }
  return g;
}

interface RunMetrics {
  pairId: string;
  bond: BondKind;
  scenarioId: string;
  totalSeconds: number;
  tA40: number | null;
  tA70: number | null;
  tEdgeOn: number | null;
  tFirstClimax: number | null;
  climaxCount: number;
  climaxAt: number[];
  climaxSpacing: number[];
  blockedBeats: number;
  softUnreadyBeats: number;
  finalA: number;
  finalE: number;
  maxA: number;
  maxE: number;
}

function recordThresholds(
  m: {
    tA40: number | null;
    tA70: number | null;
    tEdgeOn: number | null;
    tFirstClimax: number | null;
    climaxAt: number[];
    maxA: number;
    maxE: number;
  },
  t: number,
  enc: EncounterArousalState,
  climaxed: boolean
) {
  if (m.tA40 == null && enc.arousal >= 40) m.tA40 = t;
  if (m.tA70 == null && enc.arousal >= 70) m.tA70 = t;
  if (m.tEdgeOn == null && enc.edge > 5) m.tEdgeOn = t;
  if (climaxed) {
    if (m.tFirstClimax == null) m.tFirstClimax = t;
    m.climaxAt.push(t);
  }
  m.maxA = Math.max(m.maxA, enc.arousal);
  m.maxE = Math.max(m.maxE, enc.edge);
}

function runPhases(opts: {
  pair: PairDef;
  bond: BondKind;
  scenarioId: string;
  phases: { label: string; durationSeconds: number; channels: LewdChannel[] }[];
}): RunMetrics {
  let proactive = cloneUnit(opts.pair.proactiveId);
  let recipient = cloneUnit(opts.pair.recipientId);
  let itemsById = {
    ...cloneItems(opts.pair.proactiveId),
    ...cloneItems(opts.pair.recipientId),
  };
  let graph = applyBondPreset({}, proactive, recipient, opts.bond);
  let encounter = createEncounterArousalState();
  let proactiveEncounter = createEncounterArousalState();

  const m = {
    tA40: null as number | null,
    tA70: null as number | null,
    tEdgeOn: null as number | null,
    tFirstClimax: null as number | null,
    climaxAt: [] as number[],
    maxA: 0,
    maxE: 0,
  };
  let blockedBeats = 0;
  let softUnreadyBeats = 0;
  let t = 0;

  for (const phase of opts.phases) {
    for (let s = 0; s < phase.durationSeconds; s++) {
      t += 1;
      const channels = phase.channels.map((ch) => ({
        ...ch,
        remainingSeconds: Math.max(0, (ch.remainingSeconds ?? ch.durationSeconds ?? 1) - s),
      }));
      const result = resolveLewdChannels({
        proactive,
        recipient,
        channels,
        holdSeconds: 1,
        encounter,
        proactiveEncounter,
        relationships: graph,
        itemsById,
      });
      encounter = result.encounter;
      proactiveEncounter = result.proactiveEncounter;
      recipient = result.recipientAfterSoil;
      if (result.proactiveAfterSoil) proactive = result.proactiveAfterSoil;
      // itemsById is mutated in place on displace.
      if (result.arousalHardBlocked || !result.intimacyAllowed) blockedBeats += 1;
      if (result.arousalSoftUnready) softUnreadyBeats += 1;
      recordThresholds(m, t, encounter, result.climaxed);
    }
  }

  const climaxSpacing = m.climaxAt.slice(1).map((x, i) => x - m.climaxAt[i]!);

  return {
    pairId: opts.pair.id,
    bond: opts.bond,
    scenarioId: opts.scenarioId,
    totalSeconds: t,
    tA40: m.tA40,
    tA70: m.tA70,
    tEdgeOn: m.tEdgeOn,
    tFirstClimax: m.tFirstClimax,
    climaxCount: m.climaxAt.length,
    climaxAt: m.climaxAt,
    climaxSpacing,
    blockedBeats,
    softUnreadyBeats,
    finalA: Math.round(encounter.arousal),
    finalE: Math.round(encounter.edge),
    maxA: Math.round(m.maxA),
    maxE: Math.round(m.maxE),
  };
}

function runScenario(
  pair: PairDef,
  bond: BondKind,
  scenario: ScenarioDef
): RunMetrics {
  const expanded = expandPreload(scenario.preloadId, scenario.variantId);
  if (!expanded) throw new Error(`Missing preload ${scenario.preloadId}`);
  return runPhases({
    pair,
    bond,
    scenarioId: scenario.id,
    phases: expanded.phases,
  });
}

function runChain(pair: PairDef, bond: BondKind): RunMetrics {
  const phases = [];
  for (const sc of CHAIN) {
    const expanded = expandPreload(sc.preloadId, sc.variantId);
    if (!expanded) throw new Error(`Missing preload ${sc.preloadId}`);
    for (const p of expanded.phases) {
      phases.push({
        ...p,
        label: `${sc.id}:${p.label}`,
      });
    }
  }
  return runPhases({
    pair,
    bond,
    scenarioId: 'chain_shoulder_kiss_groin',
    phases,
  });
}

function fmt(n: number | null): string {
  return n == null ? '—' : String(n);
}

function printRow(r: RunMetrics) {
  const spacing =
    r.climaxSpacing.length > 0
      ? r.climaxSpacing.slice(0, 6).join(',') +
        (r.climaxSpacing.length > 6 ? '…' : '')
      : '—';
  console.log(
    [
      r.pairId.padEnd(15),
      r.bond.padEnd(7),
      r.scenarioId.padEnd(28),
      `A40 ${fmt(r.tA40).padStart(3)}`,
      `A70 ${fmt(r.tA70).padStart(3)}`,
      `edge ${fmt(r.tEdgeOn).padStart(3)}`,
      `clim1 ${fmt(r.tFirstClimax).padStart(3)}`,
      `n ${String(r.climaxCount).padStart(2)}`,
      `gap [${spacing}]`,
      `fin A${r.finalA}/E${r.finalE}`,
      `max A${r.maxA}/E${r.maxE}`,
      `block ${r.blockedBeats}`,
      `soft ${r.softUnreadyBeats}`,
      `T${r.totalSeconds}`,
    ].join('  ')
  );
}

function parseArgs(argv: string[]) {
  const out = {
    chain: false,
    json: false,
    pair: null as string | null,
    bond: null as BondKind | null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--chain') out.chain = true;
    else if (a === '--json') out.json = true;
    else if (a === '--pair') out.pair = argv[++i] ?? null;
    else if (a === '--bond') out.bond = (argv[++i] as BondKind) ?? null;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const pairs = PAIRS.filter((p) => !args.pair || p.id === args.pair);
const bonds = (Object.keys(BOND_PRESETS) as BondKind[]).filter(
  (b) => !args.bond || b === args.bond
);

if (pairs.length === 0) {
  console.error('No pairs matched. Known:', PAIRS.map((p) => p.id).join(', '));
  process.exit(1);
}

console.log(
  'Lewd arousal/edge matrix — hold=1s/tick (Lab playback cadence)\n' +
    'Metrics: seconds to A≥40 / A≥70 / edge>5 / first climax; climax count & gaps; blocks\n'
);

const results: RunMetrics[] = [];

if (args.chain) {
  for (const pair of pairs) {
    for (const bond of bonds) {
      const r = runChain(pair, bond);
      results.push(r);
      if (!args.json) printRow(r);
    }
  }
} else {
  for (const pair of pairs) {
    for (const bond of bonds) {
      for (const sc of SCENARIOS) {
        const r = runScenario(pair, bond, sc);
        results.push(r);
        if (!args.json) printRow(r);
      }
    }
  }
}

if (args.json) {
  console.log(JSON.stringify(results, null, 2));
} else {
  console.log(
    '\nTips: --chain for sequential preloads; --pair sain-amberyl --bond warm to focus.'
  );
}
