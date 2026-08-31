import type { Sex, SpermEntrySite } from '../../types/characters';

/**
 * Stub discharge events on climax — foundation for semen / fluids / impregnation.
 * Volumes are relative lab units (not mL yet).
 */
export type FluidKind =
  | 'semen'
  | 'preEjaculate'
  | 'femaleEjaculate'
  | 'lubricationSurge';

export interface FluidDischargeEvent {
  fromId: string;
  fromSex: Sex;
  kind: FluidKind;
  /** Relative 0–1+ volume for this beat. */
  volume: number;
  climaxIndex: number;
  note: string;
  /** Deposit / entry site for conception ascent (semen). */
  site?: SpermEntrySite;
}

export function dischargeOnClimax(input: {
  unitId: string;
  sex: Sex;
  climaxCountAfter: number;
  role: 'proactive' | 'recipient';
  site?: SpermEntrySite;
}): FluidDischargeEvent {
  const { unitId, sex, climaxCountAfter, role, site } = input;
  if (sex === 'M') {
    return {
      fromId: unitId,
      fromSex: sex,
      kind: climaxCountAfter <= 1 ? 'semen' : 'semen',
      volume: Math.max(0.35, 1.05 - (climaxCountAfter - 1) * 0.18),
      climaxIndex: climaxCountAfter,
      site,
      note: `${role} male climax → semen discharge${site ? ` @ ${site}` : ''}`,
    };
  }
  return {
    fromId: unitId,
    fromSex: sex,
    kind: 'femaleEjaculate',
    volume: Math.max(0.25, 0.75 - (climaxCountAfter - 1) * 0.1),
    climaxIndex: climaxCountAfter,
    note: `${role} female climax → fluid surge (tracking stub)`,
  };
}
