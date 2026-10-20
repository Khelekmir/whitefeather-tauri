/**
 * Rain-only cloak wrap coverage by equipment slot.
 * Distinct from combat body-part coverage presets — assumes the wearer
 * pulls the cloak tight to maximize rain shelter.
 */

import type { ItemSlot } from '../../types/items';

export type CloakSize = 'small' | 'medium' | 'large';

/** Fraction of that slot’s garment sheltered from rain (0–1). */
export type CloakRainSlotCoverage = Partial<Record<ItemSlot, number>>;

/**
 * Slot coverage while huddled under the cloak in rain.
 * Values are how much rain that layer is blocked from (before soak-through).
 */
export const CLOAK_RAIN_COVERAGE: Record<CloakSize, CloakRainSlotCoverage> = {
  /** Short civilian / shoulder cloak — upper torso only when pulled tight. */
  small: {
    head: 0.12,
    shoulder: 0.7,
    chest: 0.48,
    shirt: 0.55,
    undershirt: 0.4,
    wrist: 0.12,
    hand: 0.08,
    waist: 0.28,
    leg: 0.08,
    underwear: 0.04,
    shin: 0,
    foot: 0,
  },
  /** Military travel cloak — wraps torso + upper legs when clutched shut. */
  medium: {
    head: 0.35,
    shoulder: 0.85,
    chest: 0.78,
    shirt: 0.82,
    undershirt: 0.72,
    wrist: 0.35,
    hand: 0.22,
    waist: 0.68,
    leg: 0.48,
    underwear: 0.28,
    shin: 0.18,
    foot: 0.05,
  },
  /** Full / robed wrap — can shelter nearly the whole outfit when huddled. */
  large: {
    head: 0.55,
    shoulder: 0.95,
    chest: 0.92,
    shirt: 0.94,
    undershirt: 0.88,
    wrist: 0.55,
    hand: 0.4,
    waist: 0.88,
    leg: 0.78,
    underwear: 0.55,
    shin: 0.45,
    foot: 0.15,
  },
};

/** Slots that participate in mean rain-mitigation readout. */
const MITIGATION_SLOTS: ItemSlot[] = [
  'head',
  'shoulder',
  'chest',
  'shirt',
  'undershirt',
  'wrist',
  'hand',
  'waist',
  'leg',
  'underwear',
  'shin',
  'foot',
];

export function cloakRainCoverageForSize(size: CloakSize): CloakRainSlotCoverage {
  return CLOAK_RAIN_COVERAGE[size];
}

/** Average slot shelter 0–1 — used by weatherExposure ambient mitigation. */
export function meanCloakRainMitigation(size: CloakSize): number {
  const cov = CLOAK_RAIN_COVERAGE[size];
  let sum = 0;
  for (const slot of MITIGATION_SLOTS) {
    sum += cov[slot] ?? 0;
  }
  return Math.round((sum / MITIGATION_SLOTS.length) * 1000) / 1000;
}

export function formatCloakSizeLabel(size: CloakSize): string {
  if (size === 'small') return 'small cloak';
  if (size === 'large') return 'large cloak';
  return 'medium cloak';
}
