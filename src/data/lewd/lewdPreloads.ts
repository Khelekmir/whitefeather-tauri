/**
 * Preload actions — authored timed sequences of loci for Lewd Lab Play.
 * Catalog actions remain atoms; preloads compose them into phases.
 */

import type { ClothingAccessMode } from '../../utils/lewd/clothingAccess';

export interface LewdPreloadLocus {
  actorPart: string;
  actionId: string;
  targetPart: string;
  /** Absolute intensity; omitted → variant intensity. */
  intensity?: number;
  /**
   * How the actor reaches the target through clothing.
   * under = skip outer soft (skirt/leg); displace = push cloth aside.
   */
  clothingAccess?: ClothingAccessMode;
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

/**
 * Light kissing + fondling (~90s). Intensities stay in 1–3.
 * Mouth + one/two hands concurrent after the soft open.
 */
const LIGHT_KISS_FONDLE_PHASES: LewdPreloadPhase[] = [
  {
    durationSeconds: 8,
    label: 'soft lip kiss',
    loci: [
      {
        actorPart: 'lips',
        actionId: 'kissLips',
        targetPart: 'lips',
        intensity: 1,
      },
    ],
  },
  {
    durationSeconds: 8,
    label: 'kiss neck side',
    loci: [
      {
        actorPart: 'lips',
        actionId: 'kissLips',
        targetPart: 'neckSide',
        intensity: 1,
      },
    ],
  },
  {
    durationSeconds: 10,
    label: 'kiss lips · palm on breast',
    loci: [
      {
        actorPart: 'lips',
        actionId: 'kissLips',
        targetPart: 'lips',
        intensity: 2,
      },
      {
        actorPart: 'handPalm',
        actionId: 'palmRub',
        targetPart: 'breast',
        intensity: 1,
      },
    ],
  },
  {
    durationSeconds: 10,
    label: 'kiss neck · fondle breast',
    loci: [
      {
        actorPart: 'lips',
        actionId: 'kissLips',
        targetPart: 'neckSide',
        intensity: 2,
      },
      {
        actorPart: 'handPalm',
        actionId: 'palmRub',
        targetPart: 'breast',
        intensity: 2,
      },
    ],
  },
  {
    durationSeconds: 10,
    label: 'kiss · palm · circle nipple',
    loci: [
      {
        actorPart: 'lips',
        actionId: 'kissLips',
        targetPart: 'lips',
        intensity: 2,
      },
      {
        actorPart: 'handPalm',
        actionId: 'palmRub',
        targetPart: 'breast',
        intensity: 2,
      },
      {
        actorPart: 'handFinger',
        actionId: 'fingerTrace',
        targetPart: 'nipple',
        intensity: 1,
      },
    ],
  },
  {
    durationSeconds: 10,
    label: 'kiss nape · thumb on nipple',
    loci: [
      {
        actorPart: 'lips',
        actionId: 'kissLips',
        targetPart: 'neckNape',
        intensity: 2,
      },
      {
        actorPart: 'handPalm',
        actionId: 'palmRub',
        targetPart: 'breast',
        intensity: 3,
      },
      {
        actorPart: 'handFinger',
        actionId: 'thumbRub',
        targetPart: 'nipple',
        intensity: 2,
      },
    ],
  },
  {
    durationSeconds: 10,
    label: 'deeper kiss · circle areola',
    loci: [
      {
        actorPart: 'lips',
        actionId: 'kissLips',
        targetPart: 'lips',
        intensity: 3,
      },
      {
        actorPart: 'handPalm',
        actionId: 'handHold',
        targetPart: 'breast',
        intensity: 2,
      },
      {
        actorPart: 'handFinger',
        actionId: 'fingerTrace',
        targetPart: 'areola',
        intensity: 2,
      },
    ],
  },
  {
    durationSeconds: 8,
    label: 'neck kisses · thumb circles nipple',
    loci: [
      {
        actorPart: 'lips',
        actionId: 'kissLips',
        targetPart: 'neckSide',
        intensity: 2,
      },
      {
        actorPart: 'handFinger',
        actionId: 'thumbRub',
        targetPart: 'nipple',
        intensity: 3,
      },
    ],
  },
  {
    durationSeconds: 8,
    label: 'soften — kiss · light palm',
    loci: [
      {
        actorPart: 'lips',
        actionId: 'kissLips',
        targetPart: 'lips',
        intensity: 2,
      },
      {
        actorPart: 'handPalm',
        actionId: 'palmRub',
        targetPart: 'breast',
        intensity: 1,
      },
    ],
  },
  {
    durationSeconds: 8,
    label: 'closing lip kiss',
    loci: [
      {
        actorPart: 'lips',
        actionId: 'kissLips',
        targetPart: 'lips',
        intensity: 1,
      },
    ],
  },
];

/** Shy: stay on intensity 1–2, skip the firmest palm/thumb peaks. */
const LIGHT_KISS_FONDLE_SHY_PHASES: LewdPreloadPhase[] = [
  {
    durationSeconds: 8,
    label: 'hesitant lip kiss',
    loci: [
      {
        actorPart: 'lips',
        actionId: 'kissLips',
        targetPart: 'lips',
        intensity: 1,
      },
    ],
  },
  {
    durationSeconds: 8,
    label: 'brush neck',
    loci: [
      {
        actorPart: 'lips',
        actionId: 'kissLips',
        targetPart: 'neckSide',
        intensity: 1,
      },
    ],
  },
  {
    durationSeconds: 10,
    label: 'kiss · light palm',
    loci: [
      {
        actorPart: 'lips',
        actionId: 'kissLips',
        targetPart: 'lips',
        intensity: 1,
      },
      {
        actorPart: 'handPalm',
        actionId: 'palmRub',
        targetPart: 'breast',
        intensity: 1,
      },
    ],
  },
  {
    durationSeconds: 10,
    label: 'kiss neck · hold breast',
    loci: [
      {
        actorPart: 'lips',
        actionId: 'kissLips',
        targetPart: 'neckSide',
        intensity: 2,
      },
      {
        actorPart: 'handPalm',
        actionId: 'handHold',
        targetPart: 'breast',
        intensity: 1,
      },
    ],
  },
  {
    durationSeconds: 10,
    label: 'kiss · trace nipple',
    loci: [
      {
        actorPart: 'lips',
        actionId: 'kissLips',
        targetPart: 'lips',
        intensity: 2,
      },
      {
        actorPart: 'handPalm',
        actionId: 'palmRub',
        targetPart: 'breast',
        intensity: 2,
      },
      {
        actorPart: 'handFinger',
        actionId: 'fingerTrace',
        targetPart: 'nipple',
        intensity: 1,
      },
    ],
  },
  {
    durationSeconds: 10,
    label: 'nape kiss · soft thumb',
    loci: [
      {
        actorPart: 'lips',
        actionId: 'kissLips',
        targetPart: 'neckNape',
        intensity: 2,
      },
      {
        actorPart: 'handFinger',
        actionId: 'thumbRub',
        targetPart: 'nipple',
        intensity: 2,
      },
    ],
  },
  {
    durationSeconds: 8,
    label: 'soft closing kiss',
    loci: [
      {
        actorPart: 'lips',
        actionId: 'kissLips',
        targetPart: 'lips',
        intensity: 1,
      },
    ],
  },
];

/** Intensity ramp for groin fondle: under-cloth phases → displace/direct peak. */
interface GroinFondleRamp {
  kissOpen: number;
  underMons: number;
  underLabia: number;
  underCombo: number;
  asideLabia: number;
  asideClit: number;
  peak: number;
}

function buildGroinFondlePhases(r: GroinFondleRamp): LewdPreloadPhase[] {
  return [
    {
      durationSeconds: 8,
      label: 'kiss lips · open',
      loci: [
        {
          actorPart: 'lips',
          actionId: 'kissLips',
          targetPart: 'lips',
          intensity: r.kissOpen,
        },
      ],
    },
    {
      durationSeconds: 10,
      label: 'kiss neck · palm mons (under)',
      loci: [
        {
          actorPart: 'lips',
          actionId: 'kissLips',
          targetPart: 'neckSide',
          intensity: r.kissOpen,
        },
        {
          actorPart: 'handPalm',
          actionId: 'palmRub',
          targetPart: 'monsVenus',
          intensity: r.underMons,
          clothingAccess: 'under',
        },
      ],
    },
    {
      durationSeconds: 10,
      label: 'kiss throat · palm mons (under)',
      loci: [
        {
          actorPart: 'lips',
          actionId: 'kissLips',
          targetPart: 'throat',
          intensity: r.kissOpen + 1,
        },
        {
          actorPart: 'handPalm',
          actionId: 'palmRub',
          targetPart: 'monsVenus',
          intensity: r.underMons + 1,
          clothingAccess: 'under',
        },
      ],
    },
    {
      durationSeconds: 10,
      label: 'kiss lips · stroke labia (under)',
      loci: [
        {
          actorPart: 'lips',
          actionId: 'kissLips',
          targetPart: 'lips',
          intensity: r.kissOpen + 1,
        },
        {
          actorPart: 'handFinger',
          actionId: 'fingerStroke',
          targetPart: 'labiaMajora',
          intensity: r.underLabia,
          clothingAccess: 'under',
        },
      ],
    },
    {
      durationSeconds: 10,
      label: 'kiss neck · mons + labia (under)',
      loci: [
        {
          actorPart: 'lips',
          actionId: 'kissLips',
          targetPart: 'neckSide',
          intensity: r.kissOpen + 1,
        },
        {
          actorPart: 'handPalm',
          actionId: 'palmRub',
          targetPart: 'monsVenus',
          intensity: r.underCombo,
          clothingAccess: 'under',
        },
        {
          actorPart: 'handFinger',
          actionId: 'fingerStroke',
          targetPart: 'labiaMajora',
          intensity: r.underLabia + 1,
          clothingAccess: 'under',
        },
      ],
    },
    {
      durationSeconds: 10,
      label: 'kiss throat · stroke labia minora (under)',
      loci: [
        {
          actorPart: 'lips',
          actionId: 'kissLips',
          targetPart: 'throat',
          intensity: r.kissOpen + 1,
        },
        {
          actorPart: 'handFinger',
          actionId: 'fingerStroke',
          targetPart: 'labiaMinora',
          intensity: r.underCombo,
          clothingAccess: 'under',
        },
      ],
    },
    {
      durationSeconds: 10,
      label: 'kiss · labia aside (displace)',
      loci: [
        {
          actorPart: 'lips',
          actionId: 'kissLips',
          targetPart: 'lips',
          intensity: r.kissOpen + 1,
        },
        {
          actorPart: 'handFinger',
          actionId: 'fingerStroke',
          targetPart: 'labiaMajora',
          intensity: r.asideLabia,
          clothingAccess: 'displace',
        },
      ],
    },
    {
      durationSeconds: 10,
      label: 'tongue kiss · labia + thumb clit (aside)',
      loci: [
        {
          actorPart: 'lips',
          actionId: 'kissTongue',
          targetPart: 'mouthShallow',
          intensity: r.asideClit,
        },
        {
          actorPart: 'handFinger',
          actionId: 'fingerStroke',
          targetPart: 'labiaMinora',
          intensity: r.asideLabia + 1,
          clothingAccess: 'displace',
        },
        {
          actorPart: 'handFinger',
          actionId: 'thumbRub',
          targetPart: 'clitoris',
          intensity: r.asideClit,
          clothingAccess: 'displace',
        },
      ],
    },
    {
      durationSeconds: 10,
      label: 'tongue kiss · thumb clit peak (aside)',
      loci: [
        {
          actorPart: 'lips',
          actionId: 'kissTongue',
          targetPart: 'mouthShallow',
          intensity: r.peak,
        },
        {
          actorPart: 'handFinger',
          actionId: 'thumbRub',
          targetPart: 'clitoris',
          intensity: r.peak,
          clothingAccess: 'displace',
        },
      ],
    },
    {
      durationSeconds: 8,
      label: 'closing lip kiss · soft thumb',
      loci: [
        {
          actorPart: 'lips',
          actionId: 'kissLips',
          targetPart: 'lips',
          intensity: r.kissOpen,
        },
        {
          actorPart: 'handFinger',
          actionId: 'thumbRub',
          targetPart: 'clitoris',
          intensity: r.asideClit,
          clothingAccess: 'displace',
        },
      ],
    },
  ];
}

/** Soft: gentle under-cloth, direct contact still climbs to 4. */
const GROIN_FONDLE_SOFT_PHASES = buildGroinFondlePhases({
  kissOpen: 2,
  underMons: 2,
  underLabia: 2,
  underCombo: 3,
  asideLabia: 3,
  asideClit: 3,
  peak: 4,
});

/** Firm: mid ramp; aside/direct peaks at 6. */
const GROIN_FONDLE_FIRM_PHASES = buildGroinFondlePhases({
  kissOpen: 3,
  underMons: 3,
  underLabia: 3,
  underCombo: 4,
  asideLabia: 4,
  asideClit: 5,
  peak: 6,
});

/** Hungry: firmer under-cloth; direct contact climbs to 7. */
const GROIN_FONDLE_HUNGRY_PHASES = buildGroinFondlePhases({
  kissOpen: 3,
  underMons: 4,
  underLabia: 4,
  underCombo: 5,
  asideLabia: 5,
  asideClit: 6,
  peak: 7,
});

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

  light_kiss_fondle: {
    id: 'light_kiss_fondle',
    label: 'Light kiss & fondle',
    blurb:
      'Soft ~90s makeout: lip and neck kisses, then concurrent palm on breast and thumb/finger circling nipple. Intensities stay in 1–3.',
    defaultVariant: 'tender',
    phases: LIGHT_KISS_FONDLE_PHASES,
    variants: {
      shy: {
        label: 'Shy',
        intensity: 1,
        phases: LIGHT_KISS_FONDLE_SHY_PHASES,
      },
      tender: {
        label: 'Tender',
        intensity: 2,
      },
      warm: {
        label: 'Warm',
        intensity: 3,
        // Same choreography; loci already pin 1–3. Fallback 3 only if a locus omits intensity.
      },
    },
  },

  groin_fondle_aside: {
    id: 'groin_fondle_aside',
    label: 'Groin fondle (under → aside)',
    blurb:
      '~110s: persistent lip/neck/throat kisses while palm rubs mons and fingers stroke labia under the outer layer, then cloth pushed aside for labia stroke + thumb on clit with tongue kissing. Direct contact ramps within each intensity variant.',
    defaultVariant: 'firm',
    phases: GROIN_FONDLE_FIRM_PHASES,
    variants: {
      soft: {
        label: 'Soft',
        intensity: 3,
        phases: GROIN_FONDLE_SOFT_PHASES,
      },
      firm: {
        label: 'Firm',
        intensity: 4,
        phases: GROIN_FONDLE_FIRM_PHASES,
      },
      hungry: {
        label: 'Hungry',
        intensity: 6,
        phases: GROIN_FONDLE_HUNGRY_PHASES,
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
