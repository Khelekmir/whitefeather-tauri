/**
 * Reaction overlay fragments — intensity/time curves for orgasm orifice clench.
 * Grip loci still come from penetrationContact; these defs only author the curve.
 * Kept out of LEWD_PRELOADS so they do not appear in the Lab preload picker.
 */

export type ReactionOrificeFamily = 'anal' | 'vaginal';

export interface ReactionPreloadPhase {
  /** Encounter-seconds this phase runs. */
  durationSeconds: number;
  /** Primary-grip intensity (underside applies undersideIntensityDelta). */
  intensity: number;
  /** Lab / log label. */
  label?: string;
}

export interface ReactionPreloadDef {
  id: string;
  label: string;
  orificeFamily: ReactionOrificeFamily;
  phases: ReactionPreloadPhase[];
}

/**
 * Anal orgasm clench (~7s base): peak spasm → rhythmic hold → flutter release.
 * Deep vs shallow only changes which penis loci are gripped (contact map).
 */
export const ORGASM_ANAL_CLENCH: ReactionPreloadDef = {
  id: 'orgasm_anal_clench',
  label: 'Orgasm anal clench',
  orificeFamily: 'anal',
  phases: [
    { durationSeconds: 2, intensity: 8, label: 'peak spasm' },
    { durationSeconds: 3, intensity: 7, label: 'rhythmic hold' },
    { durationSeconds: 2, intensity: 5, label: 'flutter release' },
  ],
};

/**
 * Vaginal orgasm clench (~7s base): same shape, slightly softer peak than anal.
 */
export const ORGASM_VAGINAL_CLENCH: ReactionPreloadDef = {
  id: 'orgasm_vaginal_clench',
  label: 'Orgasm vaginal clench',
  orificeFamily: 'vaginal',
  phases: [
    { durationSeconds: 2, intensity: 8, label: 'peak spasm' },
    { durationSeconds: 3, intensity: 6, label: 'rhythmic hold' },
    { durationSeconds: 2, intensity: 4, label: 'flutter release' },
  ],
};

export const LEWD_REACTION_PRELOADS: Record<string, ReactionPreloadDef> = {
  [ORGASM_ANAL_CLENCH.id]: ORGASM_ANAL_CLENCH,
  [ORGASM_VAGINAL_CLENCH.id]: ORGASM_VAGINAL_CLENCH,
};

export function getReactionPreload(id: string): ReactionPreloadDef | null {
  return LEWD_REACTION_PRELOADS[id] ?? null;
}

export function reactionPreloadForOrificeFamily(
  family: ReactionOrificeFamily
): ReactionPreloadDef {
  return family === 'anal' ? ORGASM_ANAL_CLENCH : ORGASM_VAGINAL_CLENCH;
}
