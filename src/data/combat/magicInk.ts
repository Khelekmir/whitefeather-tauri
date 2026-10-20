/**
 * Spell ink — conduit for casting from a tome page.
 * Cast conceptually consumes ink on a page (leaves it blank); ink grade
 * multiplies spell power. School-specific additives (e.g. blood for dark)
 * come later — start with common ink @ 1.0.
 */

export const INK_GRADE_IDS = ['common'] as const;

export type InkGradeId = (typeof INK_GRADE_IDS)[number];

export interface InkGradeDef {
  id: InkGradeId;
  label: string;
  /** Multiplier on final spell power (1 = baseline). */
  powerMult: number;
  note?: string;
}

export const INK_GRADES: Record<InkGradeId, InkGradeDef> = {
  common: {
    id: 'common',
    label: 'Common Ink',
    powerMult: 1,
    note: 'Baseline conduit ink. School-specialized blends (blood additives for dark, etc.) later.',
  },
};

export function getInkGrade(id: string): InkGradeDef | null {
  return (INK_GRADES as Record<string, InkGradeDef>)[id] ?? null;
}
