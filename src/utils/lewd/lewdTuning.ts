/**
 * Knobs for lewd encounter sandbox.
 * Surface model: Arousal / Edge / Discomfort (0–100).
 * Psych vs physio: mental charge can warm someone up; Edge/climax needs erogenous physio.
 */
export const LEWD_TUNING = {
  intensityMin: 1,
  intensityMax: 10,

  /** How far past preferredIntensity still counts as “attuned”. */
  attunedIntensitySlop: 1.0,

  /** Overstep begins this far above preferredIntensity. */
  overstepAbovePreferred: 1.5,

  /**
   * Combat bruise → intimacy: full bruise (1.0) subtracts this many
   * preferred-intensity ranks on the mapped body region.
   */
  bruisePrefIntensityPenalty: 3,

  /**
   * Erogenous ranking from catalog sensitivity.
   * Neck ~4.5 → low rank; lips ~6.5 → modest; clit/glans ~9.5+ → near 1.
   */
  erogenous: {
    sensFloor: 1.5,
    sensCeiling: 9.9,
    /** Higher = harsher drop-off for mid-sensitivity parts. */
    curvePower: 2.15,
    /**
     * Even purely psychological play can raise arousal toward this floor.
     * True erogenous zones raise the soft cap toward 100.
     */
    arousalPsychFloor: 42,
    /** Soft-cap shaping: lower = mid zones get a bit more headroom. */
    arousalCapPower: 1.15,
    /** Edge accrual scales with rank^this (neck nearly negligible). */
    edgePhysioPower: 1.85,
    /** Minimum rank before Edge can accrue at all (soft floor). */
    edgeMinRank: 0.18,
  },

  stimulation: {
    a: 2.25,
    b: 0.45,
    c: 0.15,
    perfectBoonDivisor: 5,
    overMaxPenaltyRate: 0.3,
    /**
     * Physio channel scale — raw genital-tier stim should land ~0.4–0.9 attuned,
     * mid zones much lower after erogenous shaping in resolve.
     */
    physioOutputScale: 0.85,
  },

  /**
   * Psychological charge from preference, lust/interest, social bond, intensity match.
   * Can be high for intimate-but-tame acts (neck kiss) without enabling climax.
   */
  psych: {
    /** Scale interest×social×preferenceMatch into 0–1. */
    outputScale: 0.95,
    /** Weight of intensity-match boon inside psych. */
    intensityMatchWeight: 0.35,
    /** Weight of region preference (liked act/zone). */
    preferenceWeight: 0.4,
    /** Weight of lust/interest × social. */
    desireContextWeight: 0.45,
  },

  /**
   * Deep acts require enough arousal (readiness). Derived from action + target intimacy,
   * then clamped to the target’s erogenous soft-cap − softSlack so an act cannot
   * demand more meter than that zone can sustain (e.g. tongue-kiss on mouth).
   */
  arousalGate: {
    /** Action intimacy at or below this needs no arousal. */
    softActIntimacy: 4.0,
    /** Arousal points required per intimacy above softActIntimacy. */
    arousalPerActIntimacy: 10.5,
    /** Target-part intimacy above this adds extra readiness need. */
    targetIntimacyBonusStart: 6.0,
    /** Higher → genital targets need more warmup before they feel welcome. */
    arousalPerTargetIntimacy: 8.5,
    maxRequired: 82,
    /**
     * If arousal is within this many points below required, allow with heavy penalty
     * (unready soft); further below → hard block.
     */
    softSlack: 10,
    /** Psych/physio multiplier when soft-unready. */
    softUnreadyQualityMult: 0.35,
    /**
     * Flat **psych** discomfort fees authored for a full ~defaultHoldSeconds perform.
     * Resolve scales by holdSeconds/defaultHold so 1s steps don’t 8×-stack.
     */
    softUnreadyDiscomfort: 14,
    /** Flat psych discomfort when hard-blocked attempt still “happens” as violation. */
    hardUnreadyDiscomfort: 20,
    /**
     * Post-orgasm gate credit (Option 2): meter can drop, but climaxCount /
     * receptivity keep continued intimacy welcome. Cold start (0 climaxes) = 0.
     */
    afterglow: {
      creditFirstClimax: 52,
      creditPerExtraClimax: 10,
      receptivityCreditPerUnit: 22,
      creditCap: 72,
    },
  },

  encounter: {
    /** Arousal gain/sec from psych quality at 1.0 (before discomfort / diminish). */
    arousalPsychGainPerSec: 2.4,
    /** Extra arousal gain/sec from physio quality (erogenous help). */
    arousalPhysioGainPerSec: 1.6,
    arousalDecayPerSec: 0.7,
    /**
     * Diminishing returns vs soft-cap fill: gain *= (1 - fill)^power.
     * Higher = first touches hit harder; later kisses add less toward the cap.
     */
    arousalDiminishPower: 2.05,
    /** Extra multiplier when arousal is still near zero (novelty / first contact). */
    noveltyBoostMax: 1.28,
    noveltyArousalBelow: 14,

    edgeArousalFloor: 32,
    /** Edge gain/sec at physioQuality=1 and erogenous=1. */
    edgeGainPerSec: 6.2,
    edgeDecayPerSec: 1.35,

    /**
     * Male post-orgasm refractory (seconds of encounter time).
     * Blocks new edge accrual and further climax; arousal may still rise.
     * Females are unaffected (no refractory write).
     */
    refractory: {
      /** Duration after first climax this encounter. */
      baseSeconds: 28,
      /** Added per prior climax (2nd orgasm harder to chain quickly). */
      perPriorClimaxExtraSeconds: 10,
      maxSeconds: 75,
      /** Edge falls faster while refractory. */
      edgeDecayMult: 1.65,
    },

    /**
     * Dual discomfort (Option A):
     * - Phys: nociception / sting / overstep force
     * - Psych: reluctance, unready push, violation, cold pain
     * Soft-block edge/climax is **mind-primary** (psych soft cap).
     * Ruin if **either** track hits its hard cap.
     */
    discomfortOverstepPerSec: 6.5,
    /**
     * Authored for one defaultHoldSeconds resolve; scaled by dt/defaultHold
     * inside updateEncounterArousal so real-time 1s steps don’t explode.
     * Goes to **psych** (trust/consent bruise), not body sting.
     */
    discomfortViolationFlat: 22,
    /** Phys decays faster at rest than psych. */
    discomfortPhysDecayPerSec: 1.8,
    discomfortPsychDecayPerSec: 1.0,
    /** @deprecated use phys/psych decay — kept as alias for idle paths */
    discomfortDecayPerSec: 1.4,

    climaxEdgeThreshold: 88,
    /** Each prior climax this encounter lowers the edge threshold slightly. */
    climaxEdgeThresholdPerPrior: 4.5,
    climaxEdgeThresholdFloor: 68,
    /**
     * Mind soft-cap: psych above this blocks edge accrual and climax
     * (reluctant path). Phys does not soft-block — good pain can still finish.
     */
    discomfortPsychSoftCap: 45,
    /** @deprecated alias — soft-block uses psych soft cap */
    discomfortSoftCap: 45,
    discomfortPhysHardCap: 78,
    discomfortPsychHardCap: 78,
    /** @deprecated alias — ruin if either hard cap hit */
    discomfortHardCap: 78,

    /** Base arousal drop on climax; further climaxes drop less (more wrecked/open). */
    climaxArousalDrop: 38,
    climaxArousalDropPerPrior: 6,
    climaxArousalDropFloor: 14,
    climaxEdgeReset: 12,
    /** Release: mind eases more than body sting. */
    climaxDiscomfortPsychRelief: 12,
    climaxDiscomfortPhysRelief: 5,
    /** @deprecated split relief — prefer phys/psych */
    climaxDiscomfortRelief: 10,
    /** After climax, leave a higher arousal floor so they stay heated. */
    climaxAfterglowFloor: 22,
    climaxAfterglowFloorPerPrior: 6,

    /**
     * Receptivity compounds with climaxes: multiplies psych/physio gains & edge.
     * Starts at 1; each climax adds receptivityPerClimax (capped).
     */
    receptivityPerClimax: 0.18,
    receptivityCap: 1.85,
    /** Idle slowly cools receptivity back toward 1. */
    receptivityIdleDecayPerSec: 0.012,

    overstepQualityMult: 0.4,
    /** Damp weights for dual tracks (pleasure/edge). */
    discomfortDampPhysK: 1.1,
    discomfortDampPsychK: 1.8,
    /** @deprecated use dampPhys/Psych */
    discomfortDampK: 1.6,

    /**
     * Catalog action.pain → phys rate at intensity 5, tolerance 5.
     * Higher intensity / lower tolerance scales up.
     */
    painPhysPerSecAtRef: 4.2,
    /**
     * Fraction of overstep phys chip that also writes psych when bond is cold
     * / unready (warm bond + appetite suppresses this).
     */
    overstepPsychShare: 0.35,
  },

  /**
   * How bond / arousal / painAppetite turn physical pain into mind strain.
   * psychShare ≈ (1 − appetite) × (1 − bondWarm) × (1 − arousalEase).
   */
  painPsych: {
    appetiteWeight: 0.7,
    bondWarmWeight: 0.85,
    arousalEaseWeight: 0.35,
    /** Floor/ceiling on psych share of a pain chip. */
    shareMin: 0.02,
    shareMax: 1.15,
  },

  /**
   * Simultaneous N-channel synthesis.
   * Lab UI may expose fewer slots than maxChannels.
   */
  channels: {
    maxChannels: 4,
    /** Soft UI default for readable lab editing. */
    labVisibleChannels: 3,
    /** Attention budget: mouth/hand/genitals/feet costs sum ≤ this. */
    attentionBudget: 4,
    /** Quality tax: × 1/(1 + attentionTaxPerExtra×overflow). */
    attentionTaxPerExtra: 0.18,
    /** Soft-OR is implicit; secondary physio add fraction after primary. */
    secondaryPhysioFraction: 0.35,
    /** Each further secondary physio × this decay. */
    secondaryPhysioDecay: 0.5,
    /** Extra discomfort for running many intense channels at once. */
    multiChannelFatiguePerExtra: 0.08,
    /** Compatible channel pairs get this psych multiplier (once). */
    synergyPsychBonus: 1.12,
  },

  /**
   * How recipient→proactive directed relationship colors intimacy gates & psych.
   */
  bond: {
    trustWeight: 0.42,
    affectionWeight: 0.42,
    desireWeight: 0.28,
    familiarityWeight: 0.08,
    warmthBonus: 14,
    desireHeatBonus: 12,
    hurtPenalty: 22,
    irritationPenalty: 12,
    suspicionPenalty: 18,
    guiltPenalty: 8,
    /** Added to weighted bond sum before comparing to required intimacy. */
    budgetSlack: 12,
    /** intimacyRequired × this vs budget (higher = stricter — strangers fail deep acts). */
    requirementScale: 0.72,
    /** Extra psych when deep act + warm bond. */
    psychWarmDeepBonus: 0.35,
    /** Psych damp when deep act + cold bond (still allowed by budget). */
    psychColdDeepPenalty: 0.4,
    /**
     * F→F without native attraction: psych damp from orientation resistance.
     * 1.0 = full wipe at resistance=1; light skinship still registers some charge.
     */
    orientationResistancePsychPenalty: 0.55,
    /** Extra intimacy-budget tax while orientation-resistant (stranger-to-sapphic feel). */
    orientationResistanceBudgetTax: 18,
  },

  /**
   * Clothing barriers for lewd contact (over / under / displace).
   * Soft layers attenuate physio and ease intimacy requirement; hard armor blocks skin/orifice.
   */
  clothing: {
    /** Physio quality mult loss at softBarrier01 = 1 (through full soft stack). */
    stimPenaltyAtFullSoft: 0.55,
    /** Intimacy-required reduction at softBarrier01 = 1 (over-cloth is less “intimate”). */
    intimacyReliefAtFullSoft: 0.35,
    /** Soft coverage below this counts as clear for that layer. */
    clearEpsilon: 0.08,
    /** Hard armor with effective coverage ≥ this blocks skin/orifice. */
    hardBlockEpsilon: 0.12,
    /** Displace amount when pushing cloth aside (0–1). */
    displaceAmount: 1,
    /** Outer soft slots skipped in `under` access mode. */
    underSkipSlots: ['shirt', 'back', 'leg'] as const,
  },

  /**
   * Ovulation-cycle bodily / fertile-crest gameplay.
   * Combined genital physio peak÷trough target ≈ 1.4–1.8 (grounded revelation).
   */
  cycle: {
    /** Max physio mult from fertile crest alone (genital targets). */
    crestPhysioMax: 1.2,
    /** Milder E/P exponents so crest isn't double-counted into cartoon heat. */
    estrogenExp: 0.055,
    progesteroneExp: 0.055,
    /** Genital sens mult at crest=0 / crest=1. */
    genitalSensFloor: 1.0,
    genitalSensCrest: 1.15,
    /** Encounter receptivity seed mult at crest (separate from climax compounding). */
    encounterRecvFloor: 1.0,
    encounterRecvCrest: 1.16,
    /** Non-genital targets get a muted crest echo. */
    nonGenitalCrestShare: 0.22,
    /** Wetness above this can emit ambient lubrication notes on genital play. */
    ambientWetnessThreshold: 0.62,
    /**
     * Idle / Pass Time arousal drip → panty wet spot (no foreplay required).
     * Drive blends lust, cycle wetness, and optional encounter arousal.
     */
    arousalDrip: {
      /** Below this 0–1 drive, no idle drip. */
      driveThreshold: 0.36,
      /** Base amount01 per hour at full drive (×100 → wet points via applyWetSoil). */
      amountPerHourAtFullDrive: 0.07,
      lustWeight: 0.55,
      cycleWetWeight: 0.3,
      encounterArousalWeight: 0.5,
    },
  },

  /**
   * Proactive (giver) encounter meters + push-willingness soft gates.
   * Deep acts need the initiator warm/interested — not only the recipient.
   */
  proactive: {
    willingnessDesireWeight: 0.45,
    willingnessArousalWeight: 0.35,
    willingnessLustWeight: 0.25,
    /** Action intimacy at/below this needs no proactive arousal to push. */
    pushSoftActIntimacy: 4.2,
    arousalPerActIntimacy: 9.5,
    pushArousalCap: 78,
    pushSoftSlack: 12,
    softUnreadyQualityMult: 0.4,
    hardUnreadyQualityMult: 0.12,
    /** Recipient-side quality tax when proactive is forcing a cold push. */
    coldPushRecipientPsychMult: 0.55,
    coldPushRecipientPhysioMult: 0.7,
  },

  defaultHoldSeconds: 8,
} as const;
