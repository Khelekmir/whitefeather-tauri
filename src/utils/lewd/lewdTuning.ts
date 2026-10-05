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
   * Arousal-warped preferred intensity: baseline prefIntensity climbs with heat.
   * Gate (may we act?) stays separate — this only moves the attunement sweet spot.
   */
  intensityWarp: {
    /** Share of heat01 from encounter arousal 0–100. */
    encounterArousalWeight: 0.8,
    /** Share of heat01 from standing lust 0–100. */
    lustWeight: 0.2,
    /** Minimum intensity ranks of climb span at libido scale. */
    spanFloor: 0.45,
    /** Added span per (libido/5); lib 5 → +0.4 before temperament. */
    spanPerLibido: 0.4,
    /** 1 = linear; >1 = late takeoff (need more heat before craving intensity). */
    warpCurve: 1,
    /** Temperament mult on hotSpan (blended primary/secondary). */
    temperament: {
      Sanguine: 1.15,
      Choleric: 1.12,
      Melancholic: 0.82,
      Phlegmatic: 0.88,
    },
    minPreferred: 0.5,
  },

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
    /**
     * Felt wetness at this value = penetration-ready lubrication (comfort benchmark).
     * Clothes may damp below this; oversat above this escalates drip / seepage.
     */
    readinessWetness: 1.0,
    /** Hard ceiling on felt wetness (readiness + oversat headroom). */
    wetnessCap: 1.75,
    /** Felt wetness above this can emit ambient lubrication notes on genital play. */
    ambientWetnessThreshold: 0.62,
    /**
     * Arousal → vaginal wetness boost (layered on lowered cycle ambient).
     * Cause→effect: lust / encounter arousal raise felt slick; drip reads that.
     */
    arousalWetness: {
      /** Max felt added at standing lust = 100. */
      lustBoostMax: 0.4,
      /** Max felt added at encounter arousal = 100. */
      encounterBoostMax: 0.45,
      /**
       * Reserved mild desire / mood contribution (wire later).
       * Pass desireMood01 0–1 into feltWetness helpers when ready.
       */
      desireMoodBoostMax: 0.1,
    },
    /**
     * Idle / Pass Time drip → panty wet spot from felt wetness.
     * Intensity scales through oversat up to wetnessCap.
     * Guardrail: avg ♀ at peak+base lust (~felt 1.0) needs ≥~8h to fill underwear capacity.
     */
    arousalDrip: {
      /** Felt wetness below this leaves no idle wet spot (below readiness). */
      soilFromWetnessThreshold: 0.42,
      /** amount01 per hour when felt wetness = wetnessCap (×100 → wet points). */
      amountPerHourAtCap: 0.12,
    },
    /**
     * In-scene per-beat cloth damp from felt wetness (kiss/fondle included).
     * Genital play adds a modest bonus — not a full felt-volume dump.
     */
    sceneArousalSoil: {
      /** Felt below this → no per-beat arousal seepage. */
      soilFromWetnessThreshold: 0.42,
      /** amount01 / sec at felt = wetnessCap (before quality scale). */
      dripPerSecAtCap: 0.004,
      /** How much beat quality (0–1) can scale drip (± around 1). */
      qualityWeight: 0.25,
      /** Genital-target bonus amount01 scale × felt (capped). */
      genitalBonusBase: 0.14,
      /** Max genital bonus amount01 per beat. */
      genitalBonusCap: 0.22,
      /**
       * Lab flavor gates by soil rate (amount01 / sec this beat).
       * Below first gate → no cloth note.
       */
      flavorRate: {
        slick: 0.0006,
        beading: 0.0018,
        dampening: 0.004,
        // above dampening → dripping
      },
    },
    /**
     * Crotch cloth seepage: inner soak capacity → overflow to outer layers.
     * Kind-open for arousal, semen, discharge, urine (stub), future oil/slime.
     */
    clothSeepage: {
      /**
       * Default wet-point capacity (underwear crotch). Palm blot (~28–54) should
       * fit with headroom; soaked (~55+) approaches overflow. Material mults scale this.
       */
      underwearCapacity: 80,
      /** Default wet-point capacity (leg / hose region pool). */
      legCapacity: 70,
      /**
       * When layer is over capacity, fraction of excess that continues outward.
       * Kept modest — soak-through is a seep, not a dump.
       */
      throughFraction: 0.28,
      /**
       * Cap amount01 that may pass onward while a region still has absorb room
       * (early concurrent seep / partial fill).
       */
      maxThroughPerApply01: 0.08,
      /**
       * When a region is at capacity it absorbs nothing — excess passes downstream
       * up to this higher per-apply cap (surges can move without vanishing).
       */
      maxThroughWhenSaturated01: 0.35,
      /**
       * Once crotch wet score ≥ this (coin≈12), a share of each new deposit
       * may seep through concurrently while the patch also expands laterally.
       */
      earlySeepFromScore: 12,
      /** Minimum concurrent through-share at exactly coin (before material mult). */
      earlySeepShareMin: 0.08,
      /** Skin smear when flow remains after all layers (fraction of remainder). */
      skinSmearFraction: 0.35,
      /**
       * Material / style soak resilience (capacity↑ absorbs more; through↑ passes faster).
       * Lace/thin cloth saturate & bleed sooner; thick cloth / leather hold longer.
       */
      material: {
        cloth: { capacityMult: 1, throughMult: 1 },
        leather: { capacityMult: 1.25, throughMult: 0.55 },
        wood: { capacityMult: 1, throughMult: 0.3 },
        iron: { capacityMult: 1, throughMult: 0.15 },
        lowGradeSteel: { capacityMult: 1, throughMult: 0.15 },
        highGradeSteel: { capacityMult: 1, throughMult: 0.12 },
        springSteel: { capacityMult: 1, throughMult: 0.12 },
        mithril: { capacityMult: 1, throughMult: 0.2 },
        adamantite: { capacityMult: 1, throughMult: 0.1 },
        unequipped: { capacityMult: 1, throughMult: 1 },
        body: { capacityMult: 1, throughMult: 1 },
      },
      /** Underwear style overlays on top of material (thin/lace vs modest/thick). */
      underwearStyle: {
        risquePanty: { capacityMult: 0.72, throughMult: 1.45 },
        pegasusPanty: { capacityMult: 0.85, throughMult: 1.2 },
        modestPanty: { capacityMult: 1.1, throughMult: 0.85 },
        tribalCloth: { capacityMult: 0.9, throughMult: 1.15 },
        longSlipSkirt: { capacityMult: 1.05, throughMult: 0.9 },
        shortSlipSkirt: { capacityMult: 0.95, throughMult: 1.05 },
        briefs: { capacityMult: 1.05, throughMult: 0.9 },
        loincloth: { capacityMult: 0.8, throughMult: 1.25 },
        shorts: { capacityMult: 1.15, throughMult: 0.8 },
      },
      /**
       * Retained vaginal semen → cloth leak per hour (× cohort volume).
       * Hasty dress without cleaning: semen reaches underwear then may overflow.
       */
      vaginalSemenLeakPerHour: 0.08,
      /** Anal retained semen leak stub rate (plug / tropes later). */
      analSemenLeakPerHour: 0.12,
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
