import type { Sex, SpermEntrySite } from '../../types/characters';
import { LEWD_TUNING as T } from './lewdTuning';

/**
 * Stub discharge events on climax — foundation for semen / fluids / impregnation.
 * Volumes are relative lab units (not mL yet).
 * ♀ volume is one truth shared by orificeSlick.vagina and cloth seepage.
 */
export type FluidKind =
  | 'semen'
  | 'preEjaculate'
  | 'femaleEjaculate'
  | 'lubricationSurge';

export type FemaleClimaxSurgeBand = 'modest' | 'strong' | 'soaking';

export interface FluidDischargeEvent {
  fromId: string;
  fromSex: Sex;
  kind: FluidKind;
  /** Relative 0–1+ volume for this beat (truth). */
  volume: number;
  climaxIndex: number;
  note: string;
  /** Deposit / entry site for conception ascent (semen). */
  site?: SpermEntrySite;
  /** ♀ surge band from volume. */
  surgeBand?: FemaleClimaxSurgeBand;
  /** Share of volume retained in orifice (♀). */
  orificeShare?: number;
  /** Share of volume onto cloth (♀). */
  clothShare?: number;
}

export interface FemaleClimaxVolumeInput {
  edgeAtClimax: number;
  arousalAtClimax: number;
  climaxCountAfter: number;
  lubricationRate01: number;
  orificeWet01: number;
  /** Optional per-character climax volume mult (e.g. Amberyl anal squirt). */
  characterVolumeMult?: number;
}

export function femaleClimaxSurgeBand(volume: number): FemaleClimaxSurgeBand {
  const F = T.cycle.femaleClimaxFluid;
  if (volume < F.surgeModestBelow) return 'modest';
  if (volume < F.surgeStrongBelow) return 'strong';
  return 'soaking';
}

/** One objective ♀ climax volume from edge-tip + cycle + fatigue. */
export function computeFemaleClimaxVolume(
  input: FemaleClimaxVolumeInput
): { volume: number; surgeBand: FemaleClimaxSurgeBand } {
  const F = T.cycle.femaleClimaxFluid;
  const edge01 = Math.max(0, Math.min(1, input.edgeAtClimax / 100));
  const arousal01 = Math.max(0, Math.min(1, input.arousalAtClimax / 100));
  const prior = Math.max(0, input.climaxCountAfter - 1);
  const fatigue = Math.max(
    F.fatigueFloor,
    1 - prior * F.fatiguePerPrior
  );
  const raw =
    F.volumeBase *
    (1 + F.edgeVolumeWeight * edge01) *
    (1 + F.arousalVolumeWeight * arousal01) *
    (1 + F.cycleVolumeWeight * (input.lubricationRate01 - 0.7)) *
    (1 + F.orificeVolumeWeight * Math.min(1, input.orificeWet01)) *
    fatigue *
    (input.characterVolumeMult ?? 1);
  const volume = Math.max(F.volumeMin, Math.min(F.volumeMax, raw));
  return { volume, surgeBand: femaleClimaxSurgeBand(volume) };
}

export function dischargeOnClimax(input: {
  unitId: string;
  sex: Sex;
  climaxCountAfter: number;
  role: 'proactive' | 'recipient';
  site?: SpermEntrySite;
  /** ♀ tip context — required for variable volume. */
  female?: FemaleClimaxVolumeInput;
}): FluidDischargeEvent {
  const { unitId, sex, climaxCountAfter, role, site } = input;
  if (sex === 'M') {
    return {
      fromId: unitId,
      fromSex: sex,
      kind: 'semen',
      volume: Math.max(0.35, 1.05 - (climaxCountAfter - 1) * 0.18),
      climaxIndex: climaxCountAfter,
      site,
      note: `${role} male climax → semen discharge${site ? ` @ ${site}` : ''}`,
    };
  }

  const F = T.cycle.femaleClimaxFluid;
  const computed = input.female
    ? computeFemaleClimaxVolume(input.female)
    : {
        volume: Math.max(0.25, 0.75 - (climaxCountAfter - 1) * 0.1),
        surgeBand: femaleClimaxSurgeBand(
          Math.max(0.25, 0.75 - (climaxCountAfter - 1) * 0.1)
        ) as FemaleClimaxSurgeBand,
      };

  return {
    fromId: unitId,
    fromSex: sex,
    kind: 'femaleEjaculate',
    volume: computed.volume,
    climaxIndex: climaxCountAfter,
    surgeBand: computed.surgeBand,
    orificeShare: F.orificeShare,
    clothShare: F.clothShare,
    note: `${role} female climax → ${computed.surgeBand} surge (vol ${computed.volume.toFixed(2)})`,
  };
}
