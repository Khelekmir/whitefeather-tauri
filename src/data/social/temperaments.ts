/**
 * Classical four temperaments + 12 primary–secondary blends.
 * Primary dominates (~2/3), secondary colors (~1/3).
 */

export const TEMPERAMENT_PRIMARIES = [
  'Sanguine',
  'Choleric',
  'Melancholic',
  'Phlegmatic',
] as const;

export type TemperamentPrimary = (typeof TEMPERAMENT_PRIMARIES)[number];

export type TemperamentBlendId =
  | 'Sanguine-Choleric'
  | 'Sanguine-Phlegmatic'
  | 'Sanguine-Melancholic'
  | 'Choleric-Sanguine'
  | 'Choleric-Melancholic'
  | 'Choleric-Phlegmatic'
  | 'Melancholic-Choleric'
  | 'Melancholic-Phlegmatic'
  | 'Melancholic-Sanguine'
  | 'Phlegmatic-Sanguine'
  | 'Phlegmatic-Choleric'
  | 'Phlegmatic-Melancholic';

export interface ParsedTemperament {
  blend: TemperamentBlendId | string;
  primary: TemperamentPrimary;
  secondary: TemperamentPrimary;
  /** Weight on primary style when blending rules (0–1). */
  primaryWeight: number;
}

const PRIMARY_SET = new Set<string>(TEMPERAMENT_PRIMARIES);

export function parseTemperament(raw: string): ParsedTemperament {
  const parts = raw.split('-').map((p) => p.trim());
  const primary = (PRIMARY_SET.has(parts[0]) ? parts[0] : 'Phlegmatic') as TemperamentPrimary;
  const secondary = (
    PRIMARY_SET.has(parts[1] ?? '') ? parts[1] : primary
  ) as TemperamentPrimary;
  return {
    blend: raw,
    primary,
    secondary,
    primaryWeight: primary === secondary ? 1 : 0.65,
  };
}
