import type { Unit as DetailedUnit } from '../../types/characters';
import {
  ensureBidirectional,
  getEdge,
  setLongTerm,
  setShortTerm,
  sexualDesireSoftCap,
  type RelationshipGraph,
} from '../../utils/social/relationshipState';
import type { LongTermRelationshipId, ShortTermRelationshipId } from './relationships';

/**
 * Starting directed bonds for the detailed cast.
 * All playable cast are adults (18+); desire still respects attraction flags.
 */

type LtSeed = Partial<Record<LongTermRelationshipId, number>>;
type StSeed = Partial<Record<ShortTermRelationshipId, number>>;

interface PairSeed {
  a: string;
  b: string;
  /** a → b */
  aToB: { lt?: LtSeed; st?: StSeed };
  /** b → a */
  bToA: { lt?: LtSeed; st?: StSeed };
}

const PAIR_SEEDS: PairSeed[] = [
  // Amberyl ↔ Sain — charged, uneven; she wants security, he flirts ahead of depth
  {
    a: 'unit_amberyl',
    b: 'unit_sain',
    aToB: {
      lt: {
        trust: 58,
        affection: 62,
        desire: 48,
        familiarity: 40,
        respect: 55,
        rivalry: 0,
      },
      st: { warmth: 25, desireHeat: 15 },
    },
    bToA: {
      lt: {
        trust: 52,
        affection: 70,
        desire: 65,
        familiarity: 38,
        respect: 50,
      },
      st: { warmth: 35, desireHeat: 30 },
    },
  },
  // Sain ↔ Kent — comrades; mild rivalry under friendship
  {
    a: 'unit_sain',
    b: 'unit_kent',
    aToB: {
      lt: {
        trust: 72,
        affection: 55,
        desire: 0,
        familiarity: 70,
        respect: 68,
        rivalry: 18,
      },
    },
    bToA: {
      lt: {
        trust: 60,
        affection: 48,
        desire: 0,
        familiarity: 70,
        respect: 45,
        rivalry: 22,
      },
      st: { irritation: 10 },
    },
  },
  // Amberyl ↔ Kent — polite distance, growing respect
  {
    a: 'unit_amberyl',
    b: 'unit_kent',
    aToB: {
      lt: { trust: 50, affection: 42, desire: 12, familiarity: 25, respect: 70 },
    },
    bToA: {
      lt: { trust: 55, affection: 40, desire: 20, familiarity: 25, respect: 52 },
    },
  },
  // Lyn ↔ Kent — duty, loyalty, quiet mutual regard
  {
    a: 'unit_lyn',
    b: 'unit_kent',
    aToB: {
      lt: { trust: 80, affection: 68, desire: 35, familiarity: 55, respect: 85 },
      st: { warmth: 20 },
    },
    bToA: {
      lt: { trust: 78, affection: 72, desire: 42, familiarity: 55, respect: 75 },
      st: { warmth: 18, desireHeat: 12 },
    },
  },
  // Lyn ↔ Florina — closest friends.
  // Florina (Whitewing) already carries sapphic Desire toward Lyn.
  // Lyn starts resistant (attractedToGirls false); soft cap can rise via closeness.
  {
    a: 'unit_lyn',
    b: 'unit_florina',
    aToB: {
      lt: { trust: 88, affection: 85, desire: 8, familiarity: 90, respect: 70 },
      st: { warmth: 40, desireHeat: 5 },
    },
    bToA: {
      lt: { trust: 90, affection: 88, desire: 48, familiarity: 90, respect: 75 },
      st: { warmth: 45, desireHeat: 18 },
    },
  },
  // Lyn ↔ Sain — wary of flirt vs fond of cheer
  {
    a: 'unit_lyn',
    b: 'unit_sain',
    aToB: {
      lt: { trust: 45, affection: 50, desire: 15, familiarity: 35, respect: 40 },
      st: { irritation: 8 },
    },
    bToA: {
      lt: { trust: 55, affection: 62, desire: 40, familiarity: 35, respect: 65 },
      st: { warmth: 20, desireHeat: 18 },
    },
  },
  // Serra ↔ Sain — loud personalities; fond annoyance + spark
  {
    a: 'unit_serra',
    b: 'unit_sain',
    aToB: {
      lt: {
        trust: 48,
        affection: 58,
        desire: 28,
        familiarity: 40,
        respect: 35,
        rivalry: 15,
      },
      st: { irritation: 15, warmth: 12, desireHeat: 10 },
    },
    bToA: {
      lt: {
        trust: 50,
        affection: 60,
        desire: 45,
        familiarity: 40,
        respect: 40,
        rivalry: 12,
      },
      st: { warmth: 18, irritation: 8, desireHeat: 22 },
    },
  },
  // Florina ↔ Kent — shy regard / protective pull (no Desire from Whitewing Florina)
  {
    a: 'unit_florina',
    b: 'unit_kent',
    aToB: {
      lt: { trust: 70, affection: 52, desire: 0, familiarity: 30, respect: 80 },
      st: { suspicion: 5, warmth: 8 },
    },
    bToA: {
      lt: { trust: 65, affection: 55, desire: 30, familiarity: 30, respect: 55 },
      st: { warmth: 10 },
    },
  },
  // Dorcas ↔ Natalie — married; deep trust, mutual care, settled desire
  {
    a: 'unit_dorcas',
    b: 'unit_natalie',
    aToB: {
      lt: {
        trust: 92,
        affection: 90,
        desire: 55,
        familiarity: 95,
        respect: 80,
      },
      st: { warmth: 40, desireHeat: 12 },
    },
    bToA: {
      lt: {
        trust: 94,
        affection: 92,
        desire: 52,
        familiarity: 95,
        respect: 78,
      },
      st: { warmth: 42, desireHeat: 10 },
    },
  },
];

function applyDirection(
  graph: RelationshipGraph,
  from: DetailedUnit,
  to: DetailedUnit,
  seed: { lt?: LtSeed; st?: StSeed }
): RelationshipGraph {
  let g = graph;
  if (seed.lt) {
    for (const [id, val] of Object.entries(seed.lt) as [
      LongTermRelationshipId,
      number,
    ][]) {
      let v = val;
      if (id === 'desire') {
        v = Math.min(v, sexualDesireSoftCap(from, to, getEdge(g, from.id, to.id)));
      }
      g = setLongTerm(g, from, to, id, v);
    }
  }
  if (seed.st) {
    for (const [id, val] of Object.entries(seed.st) as [
      ShortTermRelationshipId,
      number,
    ][]) {
      let v = val;
      if (id === 'desireHeat') {
        v = Math.min(v, sexualDesireSoftCap(from, to, getEdge(g, from.id, to.id)));
      }
      g = setShortTerm(g, from, to, id, v);
    }
  }
  return g;
}

/** Build a relationship graph seeded for whatever cast units are provided. */
export function buildCastRelationshipGraph(
  units: DetailedUnit[]
): RelationshipGraph {
  const byId = new Map(units.map((u) => [u.id, u]));
  let graph: RelationshipGraph = {};

  for (const pair of PAIR_SEEDS) {
    const a = byId.get(pair.a);
    const b = byId.get(pair.b);
    if (!a || !b) continue;
    graph = ensureBidirectional(graph, a, b);
    graph = applyDirection(graph, a, b, pair.aToB);
    graph = applyDirection(graph, b, a, pair.bToA);
  }

  return graph;
}
