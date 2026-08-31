import type { Sex } from '../../types/characters';
import { bodilyStateFromHormones } from '../../utils/lewd/cycleBodilyState';
import {
  hormonesForUnit,
  type CyclePhase,
  type HormoneSnapshot,
} from '../../utils/lewd/ovulationCycle';
import type { Unit as DetailedUnit } from '../../types/characters';

type Sexed = string | { F: string; M: string };

function pick(line: Sexed, sex: Sex): string {
  if (typeof line === 'string') return line;
  return sex === 'F' ? line.F : line.M;
}

/**
 * Observable cycle tells — appended to mood tell, not a second posture.
 * Crest lines win over generic phase lines when fertileCrest is high.
 */
const PHASE_TELL: Record<CyclePhase, Sexed> = {
  Menstrual: {
    F: 'she carries a low ache and little patience for being handled',
    M: 'he seems drawn inward, energy banked low',
  },
  Follicular: {
    F: 'there is a quiet warming in her — easier laugh, easier lean',
    M: 'he seems to be coming back online, appetite returning',
  },
  Ovulation: {
    F: 'her attention snags on proximity; skinship lands hotter than usual',
    M: 'he tracks closeness with uncommon focus',
  },
  Luteal: {
    F: 'she is softer-edged and pricklier by turns — touch needs asking twice',
    M: 'he seems heavier in mood, less eager to be pressed',
  },
};

const CREST_TELL: Sexed = {
  F: 'fertile restlessness shows — slicker, quicker to flush at a brush of contact',
  M: 'something restless rides him hard, seeking friction',
};

const MUCUS_TELL: Partial<Record<string, Sexed>> = {
  eggWhite: {
    F: 'egg-white slickness makes even light friction feel invited',
    M: 'his body answers touch with uncommon readiness',
  },
  bloody: {
    F: 'she is bleeding through the week — desire muffled under the bleed',
    M: 'he seems drained, not hunting heat',
  },
  dry: {
    F: 'the quiet dry stretch before the next bleed — little invitation in the body',
    M: 'appetite sits dull and far off',
  },
};

export function cycleTellFromHormones(
  h: HormoneSnapshot,
  lengthDays: number,
  sex: Sex
): string {
  const body = bodilyStateFromHormones(h, lengthDays);
  if (body.fertileCrest01 >= 0.7) {
    return pick(CREST_TELL, sex);
  }
  const mucus = MUCUS_TELL[body.mucusKind];
  if (mucus && (body.mucusKind === 'eggWhite' || body.mucusKind === 'bloody' || body.mucusKind === 'dry')) {
    // Prefer vivid mucus tells at extremes; otherwise phase.
    if (body.mucusKind === 'eggWhite' || body.fertileCrest01 < 0.25) {
      return pick(mucus, sex);
    }
  }
  return pick(PHASE_TELL[h.phase], sex);
}

/** Null for non-cycling cast. */
export function cycleTellForUnit(unit: DetailedUnit): string | null {
  const h = hormonesForUnit(unit);
  if (!h) return null;
  return cycleTellFromHormones(
    h,
    unit.lewdStats.static.ovulationCycleLength || 28,
    unit.sex
  );
}
