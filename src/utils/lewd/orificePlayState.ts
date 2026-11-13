/**
 * Encounter-local orifice dilation / stretch for tease→probe→insert comfort.
 */

import type { Unit as DetailedUnit } from '../../types/characters';
import type { EncounterArousalState } from './encounterArousal';
import {
  type InsertableSizeClass,
  sizeRank,
} from './insertableSize';
import { LEWD_TUNING as T } from './lewdTuning';
import { addOrificeSlickLayer, type OrificeId } from './orificeSlick';

export type OrificePlayFamily = 'vagina' | 'anal' | 'mouth';

export interface HeldInsertable {
  sizeClass: InsertableSizeClass;
  itemId?: string;
}

export interface OrificePlayState {
  dilation01: number;
  stretchFatigue01: number;
  /**
   * Rubbed-raw fatigue 0–1 (anal / vagina). Builds from dry × oversize × force;
   * high raw + forcing can tear itemizedHealth (anus or groin).
   */
  raw01: number;
  /** Encounter already wrote an orifice tear from raw this scene. */
  tornThisEncounter?: boolean;
  /** @deprecated use tornThisEncounter */
  analTornThisEncounter?: boolean;
  lastSizeRank: number;
  heldInsertable?: HeldInsertable;
}

export type OrificePlayByFamily = Partial<
  Record<OrificePlayFamily, OrificePlayState>
>;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function emptyOrificePlayState(
  seed?: Partial<OrificePlayState>
): OrificePlayState {
  return {
    dilation01: clamp01(seed?.dilation01 ?? 0),
    stretchFatigue01: clamp01(seed?.stretchFatigue01 ?? 0),
    raw01: clamp01(seed?.raw01 ?? 0),
    tornThisEncounter:
      seed?.tornThisEncounter ?? seed?.analTornThisEncounter ?? false,
    analTornThisEncounter:
      seed?.tornThisEncounter ?? seed?.analTornThisEncounter ?? false,
    lastSizeRank: seed?.lastSizeRank ?? 0,
    heldInsertable: seed?.heldInsertable,
  };
}

export function orificeFamilyFromTarget(
  targetPart: string
): OrificePlayFamily | null {
  if (/^vagina/i.test(targetPart)) return 'vagina';
  // Vestibule / outer genital tease still feeds vaginal dilation + raw.
  if (
    /^labia/i.test(targetPart) ||
    targetPart === 'clitoris' ||
    targetPart === 'monsVenus' ||
    targetPart === 'perinium' ||
    targetPart === 'urethra'
  ) {
    return 'vagina';
  }
  if (/^(anus|rectum)/i.test(targetPart)) return 'anal';
  if (/^mouth/i.test(targetPart)) return 'mouth';
  // Surface verge tease on anus proper
  if (targetPart === 'anus') return 'anal';
  return null;
}

export function orificeIdForFamily(family: OrificePlayFamily): OrificeId {
  if (family === 'anal') return 'anus';
  if (family === 'vagina') return 'vagina';
  return 'mouth';
}

export function getOrificePlayState(
  map: OrificePlayByFamily | undefined,
  family: OrificePlayFamily
): OrificePlayState {
  return map?.[family] ? { ...map[family]! } : emptyOrificePlayState();
}

/** Seed anal plug: raises starting dilation and marks held insertable. */
export function seedAnalPlug(
  map: OrificePlayByFamily | undefined,
  opts?: { dilation01?: number; sizeClass?: InsertableSizeClass; itemId?: string }
): OrificePlayByFamily {
  const P = T.orificePlay;
  const next = { ...(map ?? {}) };
  const sizeClass = opts?.sizeClass ?? P.analPlugSizeClass;
  next.anal = emptyOrificePlayState({
    dilation01: opts?.dilation01 ?? P.analPlugSeedDilation01,
    lastSizeRank: sizeRank(sizeClass),
    heldInsertable: { sizeClass, itemId: opts?.itemId },
  });
  return next;
}

export function clearHeldInsertable(
  map: OrificePlayByFamily | undefined,
  family: OrificePlayFamily
): OrificePlayByFamily {
  const next = { ...(map ?? {}) };
  const cur = getOrificePlayState(next, family);
  const { heldInsertable: _drop, ...rest } = cur;
  next[family] = rest;
  return next;
}

/**
 * Ensure ♀ anus has baseline slick for scene start / Lab reset.
 * Only seeds when the anus key was never initialized. An explicit wipe
 * (`anus: []`) is respected so dry-entry tests stay dry.
 */
export function ensureAnalBaselineSlick(unit: DetailedUnit): DetailedUnit {
  if (unit.sex !== 'F') return unit;
  const P = T.orificePlay;
  const prev = unit.lewdStats.dynamic.orificeSlick ?? {};
  if (prev.anus !== undefined) return unit;
  const layers = addOrificeSlickLayer(
    undefined,
    'analBaseline',
    P.analBaselineAmount01,
    P.analBaselineQuality01
  );
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: {
        ...unit.lewdStats.dynamic,
        orificeSlick: { ...prev, anus: layers },
      },
    },
  };
}

/** Wipe anal slick (Lab dry-test helper). Leaves anus: [] so ensure will not reseed. */
export function clearAnalSlick(unit: DetailedUnit): DetailedUnit {
  const prev = unit.lewdStats.dynamic.orificeSlick ?? {};
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: {
        ...unit.lewdStats.dynamic,
        orificeSlick: { ...prev, anus: [] },
      },
    },
  };
}

export function readOrificePlayFromEncounter(
  encounter: EncounterArousalState
): OrificePlayByFamily {
  const raw = encounter.orificePlay;
  if (!raw) return {};
  const out: OrificePlayByFamily = {};
  for (const key of ['vagina', 'anal', 'mouth'] as OrificePlayFamily[]) {
    const s = raw[key];
    if (!s) continue;
    out[key] = emptyOrificePlayState({
      dilation01: s.dilation01,
      stretchFatigue01: s.stretchFatigue01,
      raw01: s.raw01 ?? 0,
      tornThisEncounter: s.tornThisEncounter ?? s.analTornThisEncounter ?? false,
      analTornThisEncounter: s.tornThisEncounter ?? s.analTornThisEncounter ?? false,
      lastSizeRank: s.lastSizeRank,
      heldInsertable: s.heldInsertable
        ? {
            sizeClass: s.heldInsertable.sizeClass as InsertableSizeClass,
            itemId: s.heldInsertable.itemId,
          }
        : undefined,
    });
  }
  return out;
}

export function writeOrificePlayToEncounter(
  encounter: EncounterArousalState,
  map: OrificePlayByFamily
): EncounterArousalState {
  return { ...encounter, orificePlay: map };
}

/**
 * Idle fade when a family had no contact this beat.
 * Held insertable keeps dilation from falling below seed floor.
 */
export function fadeOrificePlayFamily(
  state: OrificePlayState,
  dt: number,
  family?: OrificePlayFamily
): OrificePlayState {
  const P = T.orificePlay;
  let dilation01 = state.dilation01;
  const heldFloor = state.heldInsertable
    ? P.analPlugSeedDilation01 * 0.85
    : 0;
  dilation01 = Math.max(
    heldFloor,
    dilation01 - P.dilationFadePerSec * Math.max(0, dt)
  );
  const stretchFatigue01 = Math.max(
    0,
    state.stretchFatigue01 - P.stretchFatigueDecayPerSec * Math.max(0, dt)
  );
  const idleRawDecay =
    family === 'vagina'
      ? P.vaginalRaw.rawDecayPerSecIdle
      : P.analRaw.rawDecayPerSecIdle;
  const raw01 = Math.max(
    0,
    (state.raw01 ?? 0) - idleRawDecay * Math.max(0, dt)
  );
  return {
    ...state,
    dilation01: clamp01(dilation01),
    stretchFatigue01: clamp01(stretchFatigue01),
    raw01: clamp01(raw01),
  };
}
