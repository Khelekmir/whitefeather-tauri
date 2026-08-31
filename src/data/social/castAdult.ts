import type { Unit as DetailedUnit } from '../../types/characters';

/** Lewd-lab eligibility: chronological adult cast only. */
export const LEWD_ADULT_MIN_AGE = 18;

export function isLewdAdult(unit: Pick<DetailedUnit, 'age'>): boolean {
  return unit.age >= LEWD_ADULT_MIN_AGE;
}

export function filterLewdAdults<T extends Pick<DetailedUnit, 'age'>>(
  units: T[]
): T[] {
  return units.filter(isLewdAdult);
}
