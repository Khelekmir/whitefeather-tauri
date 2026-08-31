import { bodilyStateFromHormones } from './cycleBodilyState';
import {
  formatCycleLabel,
  isInFertileWindow,
  type HormoneSnapshot,
} from './ovulationCycle';

export interface CycleShiftNote {
  changed: boolean;
  phaseChanged: boolean;
  fertileEdge: 'entered' | 'left' | null;
  /** Compact Pass Time log fragment (empty if nothing notable). */
  summary: string;
}

/**
 * Diff cycle state across a Pass Time tick — phase change, fertile edge, lust Δ, mucus.
 */
export function describeCycleShift(input: {
  before: HormoneSnapshot | null;
  after: HormoneSnapshot | null;
  lengthDays: number;
  lustFrom: number;
  lustTo: number;
}): CycleShiftNote {
  const { before, after, lengthDays, lustFrom, lustTo } = input;
  if (!after) {
    return {
      changed: false,
      phaseChanged: false,
      fertileEdge: null,
      summary: '',
    };
  }

  const phaseChanged = !!before && before.phase !== after.phase;
  const fertileBefore = before ? isInFertileWindow(before, lengthDays) : false;
  const fertileAfter = isInFertileWindow(after, lengthDays);
  let fertileEdge: CycleShiftNote['fertileEdge'] = null;
  if (!fertileBefore && fertileAfter) fertileEdge = 'entered';
  if (fertileBefore && !fertileAfter) fertileEdge = 'left';

  const lustDelta = lustTo - lustFrom;
  const lustMoved = Math.abs(lustDelta) >= 0.75;
  const body = bodilyStateFromHormones(after, lengthDays);
  const notable = phaseChanged || fertileEdge != null || lustMoved;
  if (!notable && !before) {
    // First snapshot only — still show where she is.
    return {
      changed: true,
      phaseChanged: false,
      fertileEdge: null,
      summary: `cycle ${formatCycleLabel(after, lengthDays)} · ${body.mucusKind}`,
    };
  }
  if (!notable) {
    return {
      changed: false,
      phaseChanged: false,
      fertileEdge: null,
      summary: '',
    };
  }

  const parts: string[] = [];
  if (phaseChanged && before) {
    parts.push(`phase ${before.phase}→${after.phase}`);
  } else {
    parts.push(formatCycleLabel(after, lengthDays));
  }
  if (fertileEdge === 'entered') parts.push('entered fertile window');
  if (fertileEdge === 'left') parts.push('left fertile window');
  if (lustMoved) {
    const sign = lustDelta >= 0 ? '+' : '';
    parts.push(`lust ${lustFrom.toFixed(0)}→${lustTo.toFixed(0)} (${sign}${lustDelta.toFixed(1)})`);
  }
  parts.push(`mucus ${body.mucusKind}`);
  if (phaseChanged || fertileEdge) {
    parts.push(body.blurb);
  }

  return {
    changed: true,
    phaseChanged,
    fertileEdge,
    summary: parts.join(' · '),
  };
}
