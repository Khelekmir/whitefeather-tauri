/**
 * Short-lived erotic memories for masturbation fantasy.
 * Witnessed / participated acts fade over memoryTtlHours.
 */

import type {
  EroticMemoryEntry,
  EroticMemoryKind,
  Unit as DetailedUnit,
} from '../../types/characters';
import { LEWD_TUNING as T } from './lewdTuning';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function eroticMemoryFreshness01(
  entry: EroticMemoryEntry,
  nowHours: number
): number {
  const ttl = T.masturbation.memoryTtlHours;
  if (!(ttl > 0)) return 1;
  const age = Math.max(0, nowHours - entry.recordedAtHours);
  if (age >= ttl) return 0;
  const u = 1 - age / ttl;
  return Math.pow(u, T.masturbation.freshnessCurve);
}

export function listFantasyCandidates(
  unit: DetailedUnit,
  nowHours: number
): Array<EroticMemoryEntry & { freshness01: number; score: number }> {
  const mem = unit.lewdStats.dynamic.eroticMemory ?? [];
  return mem
    .map((e) => {
      const freshness01 = eroticMemoryFreshness01(e, nowHours);
      const score =
        freshness01 *
        Math.max(0.05, e.actIntimacy / T.masturbation.intimacyRef);
      return { ...e, freshness01, score };
    })
    .filter((e) => e.freshness01 > 0.02)
    .sort((a, b) => b.score - a.score);
}

function memoryKey(e: Pick<EroticMemoryEntry, 'kind' | 'partnerIds' | 'actionId' | 'actIntimacy'>): string {
  const partners = [...e.partnerIds].sort().join(',');
  return `${e.kind}|${partners}|${e.actionId ?? ''}|${Math.round(e.actIntimacy * 10)}`;
}

export function rememberEroticEvent(
  unit: DetailedUnit,
  entry: Omit<EroticMemoryEntry, 'id'> & { id?: string }
): DetailedUnit {
  const cap = T.masturbation.memoryCap;
  const prev = [...(unit.lewdStats.dynamic.eroticMemory ?? [])];
  const id =
    entry.id ??
    `em_${entry.kind}_${entry.partnerIds.join('_') || 'anon'}_${Math.round(entry.recordedAtHours * 10)}`;
  const nextEntry: EroticMemoryEntry = {
    id,
    kind: entry.kind,
    partnerIds: [...entry.partnerIds],
    actionId: entry.actionId,
    actIntimacy: Math.max(0, Math.min(10, entry.actIntimacy)),
    targetParts: entry.targetParts ? [...entry.targetParts] : undefined,
    recordedAtHours: entry.recordedAtHours,
    intensity: entry.intensity,
  };
  const key = memoryKey(nextEntry);
  const idx = prev.findIndex((e) => memoryKey(e) === key);
  if (idx >= 0) {
    // Refresh freshness / bump intimacy if deeper.
    const old = prev[idx]!;
    prev[idx] = {
      ...old,
      ...nextEntry,
      id: old.id,
      actIntimacy: Math.max(old.actIntimacy, nextEntry.actIntimacy),
      recordedAtHours: Math.max(old.recordedAtHours, nextEntry.recordedAtHours),
    };
  } else {
    prev.unshift(nextEntry);
  }
  const trimmed = prev
    .sort((a, b) => b.recordedAtHours - a.recordedAtHours)
    .slice(0, cap);
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: { ...unit.lewdStats.dynamic, eroticMemory: trimmed },
    },
  };
}

/** Drop stale memories; optionally advance as if `hours` passed on the clock. */
export function advanceEroticMemory(
  unit: DetailedUnit,
  nowHours: number
): DetailedUnit {
  const mem = unit.lewdStats.dynamic.eroticMemory;
  if (!mem?.length) return unit;
  const kept = mem.filter((e) => eroticMemoryFreshness01(e, nowHours) > 0.02);
  if (kept.length === mem.length) return unit;
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: {
        ...unit.lewdStats.dynamic,
        eroticMemory: kept.length ? kept : undefined,
      },
    },
  };
}

export function clearEroticMemory(unit: DetailedUnit): DetailedUnit {
  if (!unit.lewdStats.dynamic.eroticMemory?.length) return unit;
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: { ...unit.lewdStats.dynamic, eroticMemory: undefined },
    },
  };
}

export function formatEroticMemoryLabel(
  entry: EroticMemoryEntry,
  partnerNames?: Record<string, string>
): string {
  const names =
    entry.partnerIds
      .map((id) => partnerNames?.[id] ?? id.replace(/^unit_/, ''))
      .join(' + ') || 'someone';
  const kind: EroticMemoryKind = entry.kind;
  const act = entry.actionId ?? `intimacy ${entry.actIntimacy.toFixed(1)}`;
  return `${kind} · ${names} · ${act}`;
}

export { clamp01 as eroticMemoryClamp01 };
