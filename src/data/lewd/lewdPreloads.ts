/**
 * Preload actions — authored timed sequences of loci for Lewd Lab Play.
 * Catalog actions remain atoms; preloads compose them into phases.
 */

export interface LewdPreloadLocus {
  actorPart: string;
  actionId: string;
  targetPart: string;
  /** Absolute intensity; omitted → variant intensity. */
  intensity?: number;
}

export interface LewdPreloadPhase {
  /** Encounter-seconds this phase runs. */
  durationSeconds: number;
  loci: LewdPreloadLocus[];
  /** Lab log label. */
  label?: string;
}

export interface LewdPreloadVariant {
  label: string;
  /** Applied where locus.intensity is omitted. */
  intensity: number;
  /** Optional full choreography override for this variant. */
  phases?: LewdPreloadPhase[];
}

export interface LewdPreloadDef {
  id: string;
  label: string;
  blurb: string;
  defaultVariant: string;
  variants: Record<string, LewdPreloadVariant>;
  /** Shared choreography when a variant does not override phases. */
  phases: LewdPreloadPhase[];
}

/** Shared shoulder-rub path (~66s). Variants mainly change intensity / a few actions. */
const SHOULDER_RUB_PHASES: LewdPreloadPhase[] = [
  {
    durationSeconds: 8,
    label: 'palm on shoulder',
    loci: [{ actorPart: 'handPalm', actionId: 'palmRub', targetPart: 'shoulder' }],
  },
  {
    durationSeconds: 8,
    label: 'fingers on nape',
    loci: [{ actorPart: 'handFinger', actionId: 'fingerStroke', targetPart: 'neckNape' }],
  },
  {
    durationSeconds: 8,
    label: 'palm on upper back',
    loci: [{ actorPart: 'handPalm', actionId: 'palmRub', targetPart: 'backUpper' }],
  },
  {
    durationSeconds: 8,
    label: 'trace neck side',
    loci: [{ actorPart: 'handFinger', actionId: 'fingerTrace', targetPart: 'neckSide' }],
  },
  {
    durationSeconds: 8,
    label: 'palm on shoulder',
    loci: [{ actorPart: 'handPalm', actionId: 'palmRub', targetPart: 'shoulder' }],
  },
  {
    durationSeconds: 8,
    label: 'fingers on nape',
    loci: [{ actorPart: 'handFinger', actionId: 'fingerStroke', targetPart: 'neckNape' }],
  },
  {
    durationSeconds: 10,
    label: 'palm on upper back',
    loci: [{ actorPart: 'handPalm', actionId: 'palmRub', targetPart: 'backUpper' }],
  },
  {
    durationSeconds: 8,
    label: 'stroke neck side',
    loci: [{ actorPart: 'handFinger', actionId: 'fingerStroke', targetPart: 'neckSide' }],
  },
];

/** Sensual: more tracing / nape dwell, slightly longer soft phases. */
const SHOULDER_RUB_SENSUAL_PHASES: LewdPreloadPhase[] = [
  {
    durationSeconds: 8,
    label: 'trace shoulder',
    loci: [{ actorPart: 'handFinger', actionId: 'fingerTrace', targetPart: 'shoulder' }],
  },
  {
    durationSeconds: 10,
    label: 'linger on nape',
    loci: [{ actorPart: 'handFinger', actionId: 'fingerStroke', targetPart: 'neckNape' }],
  },
  {
    durationSeconds: 8,
    label: 'soft palm on back',
    loci: [{ actorPart: 'handPalm', actionId: 'palmRub', targetPart: 'backUpper' }],
  },
  {
    durationSeconds: 10,
    label: 'trace neck side',
    loci: [{ actorPart: 'handFinger', actionId: 'fingerTrace', targetPart: 'neckSide' }],
  },
  {
    durationSeconds: 8,
    label: 'palm on shoulder',
    loci: [{ actorPart: 'handPalm', actionId: 'palmRub', targetPart: 'shoulder' }],
  },
  {
    durationSeconds: 10,
    label: 'nape again',
    loci: [{ actorPart: 'handFinger', actionId: 'fingerStroke', targetPart: 'neckNape' }],
  },
  {
    durationSeconds: 8,
    label: 'trace upper back',
    loci: [{ actorPart: 'handFinger', actionId: 'fingerTrace', targetPart: 'backUpper' }],
  },
];

/** Light: prefer trace over stroke, same skeleton as firm. */
const SHOULDER_RUB_LIGHT_PHASES: LewdPreloadPhase[] = SHOULDER_RUB_PHASES.map((p) => ({
  ...p,
  loci: p.loci.map((l) =>
    l.actionId === 'fingerStroke'
      ? { ...l, actionId: 'fingerTrace' }
      : l
  ),
}));

export const LEWD_PRELOADS: Record<string, LewdPreloadDef> = {
  give_shoulder_rub: {
    id: 'give_shoulder_rub',
    label: 'Give shoulder rub',
    blurb:
      'Scripted ~60s rub: palm and fingers alternate across shoulder, nape, neck side, and upper back.',
    defaultVariant: 'firm',
    phases: SHOULDER_RUB_PHASES,
    variants: {
      light: {
        label: 'Light',
        intensity: 2,
        phases: SHOULDER_RUB_LIGHT_PHASES,
      },
      firm: {
        label: 'Firm',
        intensity: 5,
      },
      sensual: {
        label: 'Sensual',
        intensity: 4,
        phases: SHOULDER_RUB_SENSUAL_PHASES,
      },
    },
  },
};

export function listLewdPreloads(): LewdPreloadDef[] {
  return Object.values(LEWD_PRELOADS);
}

export function getLewdPreload(id: string): LewdPreloadDef | null {
  return LEWD_PRELOADS[id] ?? null;
}
