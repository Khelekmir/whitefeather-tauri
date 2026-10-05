/**
 * Arrow composition: shaft grade × head style × head material.
 * Lodged/extract rules key off style (+ material scale); impact uses all three.
 */

import { getMaterial } from './materials';
import type {
  ArrowHeadStyle,
  ArrowShaftGrade,
  MaterialId,
} from '../../types/items';

/** Materials allowed for arrowheads in this cut. */
export const ARROW_HEAD_MATERIALS: readonly MaterialId[] = [
  'wood',
  'iron',
  'lowGradeSteel',
  'highGradeSteel',
  'springSteel',
  'mithril',
  'adamantite',
] as const;

export interface ArrowShaftProfile {
  grade: ArrowShaftGrade;
  /** Abstract projectile mass. */
  mass: number;
  label: string;
}

export interface ArrowHeadStyleProfile {
  style: ArrowHeadStyle;
  label: string;
  /** Base tip energy before material scale. */
  tipFactor: number;
  /** External bleed rate mult while shaft remains (plug). */
  lodgedExternalBleedMult: number;
  /** InternalBleed += this × minutes (before material scale). */
  aggravateInternalPerMinute: number;
  /** InternalBleed += this per attack/dodge/parry (before material scale). */
  aggravateInternalOnAction: number;
  /** External bleed intensity added on extract (before material scale). */
  extractExternalSpike: number;
  /** Internal bleed intensity added on extract (before material scale). */
  extractInternalSpike: number;
}

export const ARROW_SHAFT_PROFILES: Record<ArrowShaftGrade, ArrowShaftProfile> = {
  light: { grade: 'light', mass: 0.75, label: 'Light shaft' },
  mid: { grade: 'mid', mass: 1, label: 'Mid shaft' },
  heavy: { grade: 'heavy', mass: 1.3, label: 'Heavy shaft' },
};

export const ARROW_HEAD_STYLE_PROFILES: Record<
  ArrowHeadStyle,
  ArrowHeadStyleProfile
> = {
  practice: {
    style: 'practice',
    label: 'Practice',
    tipFactor: 0.85,
    lodgedExternalBleedMult: 0.6,
    aggravateInternalPerMinute: 0.002,
    aggravateInternalOnAction: 0.01,
    extractExternalSpike: 0.12,
    extractInternalSpike: 0.05,
  },
  hunting: {
    style: 'hunting',
    label: 'Hunting',
    tipFactor: 1.05,
    lodgedExternalBleedMult: 0.42,
    aggravateInternalPerMinute: 0.006,
    aggravateInternalOnAction: 0.025,
    extractExternalSpike: 0.35,
    extractInternalSpike: 0.2,
  },
  war: {
    style: 'war',
    label: 'War',
    tipFactor: 1.15,
    lodgedExternalBleedMult: 0.35,
    aggravateInternalPerMinute: 0.01,
    aggravateInternalOnAction: 0.04,
    extractExternalSpike: 0.55,
    extractInternalSpike: 0.35,
  },
  /** Narrow armor-piercing tip — hard impact, cleaner extract than broad/war heads. */
  bodkin: {
    style: 'bodkin',
    label: 'Bodkin',
    tipFactor: 1.22,
    lodgedExternalBleedMult: 0.4,
    aggravateInternalPerMinute: 0.008,
    aggravateInternalOnAction: 0.032,
    extractExternalSpike: 0.22,
    extractInternalSpike: 0.15,
  },
};

/**
 * Material tear scale for aggravation / extract (not plug).
 * wood ~0.75 … adamantite ~1.35
 */
export function arrowHeadMaterialScale(material: MaterialId): number {
  const strength = getMaterial(material).strength;
  const t = Math.max(0, Math.min(1, (strength - 2) / 8));
  return 0.75 + 0.6 * t;
}

/** Tip mult from head material strength. */
export function arrowHeadMaterialTipMult(material: MaterialId): number {
  const strength = getMaterial(material).strength;
  return Math.max(0.65, Math.min(1.45, 0.7 + 0.05 * strength));
}

export function getArrowShaftProfile(
  grade: ArrowShaftGrade | null | undefined
): ArrowShaftProfile {
  return ARROW_SHAFT_PROFILES[grade ?? 'mid'] ?? ARROW_SHAFT_PROFILES.mid;
}

export function getArrowHeadStyleProfile(
  style: ArrowHeadStyle | null | undefined
): ArrowHeadStyleProfile {
  return (
    ARROW_HEAD_STYLE_PROFILES[style ?? 'hunting'] ??
    ARROW_HEAD_STYLE_PROFILES.hunting
  );
}

/** Derive mass + tip from composition (authored overrides win upstream). */
export function deriveArrowImpactStats(input: {
  shaftGrade?: ArrowShaftGrade | null;
  arrowHeadStyle?: ArrowHeadStyle | null;
  material?: MaterialId | null;
}): { mass: number; tipFactor: number } {
  const shaft = getArrowShaftProfile(input.shaftGrade ?? 'mid');
  const style = getArrowHeadStyleProfile(input.arrowHeadStyle ?? 'hunting');
  const mat = input.material ?? 'iron';
  return {
    mass: shaft.mass,
    tipFactor: style.tipFactor * arrowHeadMaterialTipMult(mat),
  };
}

export function formatArrowComposition(input: {
  shaftGrade?: ArrowShaftGrade | null;
  arrowHeadStyle?: ArrowHeadStyle | null;
  material?: MaterialId | null;
}): string {
  const style = getArrowHeadStyleProfile(input.arrowHeadStyle ?? 'hunting');
  const shaft = getArrowShaftProfile(input.shaftGrade ?? 'mid');
  const mat = input.material ?? 'iron';
  return `${style.label} · ${shaft.grade} · ${mat}`;
}
