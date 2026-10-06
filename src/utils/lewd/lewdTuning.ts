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
    /**
     * ♀ testosterone slightly lowers required arousal for acts.
     * T snapshots are ~1–2.8 (unlike E which peaks ~20) — linear in (T−1) is fine.
     * required *= clamp(1 - weight*(T-1), min, max)
     */
    testosteroneRequiredMult: {
      weight: 0.07,
      min: 0.88,
      max: 1.0,
    },
  },

  encounter: {
    /** Arousal gain/sec from psych quality at 1.0 (before discomfort / diminish). */
    arousalPsychGainPerSec: 2.4,
    /** Extra arousal gain/sec from physio quality (erogenous help). */
    arousalPhysioGainPerSec: 1.6,
    /**
     * ♀ estrogen → encounter arousal gain (physio and psych equally).
     * E peaks ~20× nadir — use ln(E) vs ref, not (E−1). T does not belong here
     * (T lowers act gates). Prepares equal psych influence for future social heat.
     */
    femaleHormoneArousal: {
      /**
       * gainMult = 1 + logWeight * (ln(E) - ln(estrogenGainRef)), clamped.
       * Ref ~3.5 ≈ mild follicular neutral.
       */
      estrogenLogWeight: 0.18,
      estrogenGainRef: 3.5,
      gainMultMin: 0.78,
      gainMultMax: 1.36,
      /**
       * Extra softCap when psych leads (non-physical / social heat headroom).
       * Scales with ln(E)/ln(estrogenPeakRef). Physical scenes still get the
       * equal E mult on psych+physio gain (intentional double voice).
       */
      psychSoftCapBonusMax: 12,
      /** E≈22 → estrogen01≈1 for softCap. */
      estrogenPeakRef: 22,
    },
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

    /**
     * Edge-tip climax: tip when instantaneous edge *push* clears a requirement
     * that shrinks as arousal + edge rise. High edge after edging → easy tip +
     * high volume; low edge + big spike → surprise small orgasm.
     * (Replaces flat edge ≥ climaxEdgeThreshold.)
     */
    climaxTip: {
      /**
       * Edge must already be at least this *before* this beat's push to tip.
       * Kept well above climaxEdgeReset so post-climax must rebuild (Lab 1s
       * ticks no longer re-tip every second from reset == minEdge).
       */
      minEdge: 22,
      /** Base instantaneous edge-push required at arousal=0, edge=0. */
      tipReqBase: 4.2,
      /** Floor on tip requirement (always need a real push on 1s Lab ticks). */
      tipReqFloor: 0.85,
      /** How much arousal (0–1) shrinks tip requirement. */
      arousalWeight: 0.55,
      /** How much edge (0–1) shrinks tip requirement. */
      edgeWeight: 0.72,
      /** Prior climaxes slightly ease tipping. */
      tipReqEasePerPrior: 0.06,
      tipReqEaseCap: 0.2,
    },
    /** @deprecated legacy flat threshold — tip model uses climaxTip */
    climaxEdgeThreshold: 88,
    /** @deprecated */
    climaxEdgeThresholdPerPrior: 4.5,
    /** @deprecated */
    climaxEdgeThresholdFloor: 68,
    /**
     * Psych discomfort continuum (0–100). Arousal/edge can coexist with rising
     * mind strain until overwhelm — then accelerating decay. Tip blocks at overwhelm.
     * Phys hard-cap still ruins; psych hard-cap = break.
     */
    psychContinuum: {
      /** Below: full arousal/edge gain. */
      notice: 18,
      /** notice→strain: mild diminishing returns. */
      strain: 38,
      /** strain→overwhelm: strong diminish; tip still allowed. */
      overwhelm: 58,
      /** At/above: tip blocked; arousal+edge accelerate decay. */
      /** break aliases discomfortPsychHardCap for ruin. */
      gainMultAtStrain: 0.65,
      gainMultAtOverwhelm: 0.18,
      /** Extra arousal/edge decay/sec once past overwhelm (scales up to break). */
      overwhelmDecayPerSec: 2.4,
      overwhelmDecayAccel: 5.5,
      /** Edge decays faster than arousal once overwhelmed. */
      overwhelmEdgeDecayMult: 1.35,
    },
    /**
     * @deprecated tip/edge soft-block now uses psychContinuum.overwhelm.
     * Kept as alias for Lab labels / old readers.
     */
    discomfortPsychSoftCap: 58,
    /** @deprecated alias — soft-block uses psych continuum overwhelm */
    discomfortSoftCap: 58,
    discomfortPhysHardCap: 78,
    discomfortPsychHardCap: 78,
    /** @deprecated alias — ruin if either hard cap hit */
    discomfortHardCap: 78,

    /**
     * Significant body discomfort bleeds into mind strain (pain → fear / flinch).
     * Wanted sting with warm bond still mostly stays on the phys track via painPsychShare;
     * this is the raw “too much body signal” spillover.
     */
    physToPsych: {
      /** Phys above this starts writing psych each second. */
      floor: 34,
      /** At phys=100, psych points added per second. */
      ratePerSecAtFull: 3.8,
      /** Curve on ((phys-floor)/(100-floor)); >1 = late takeoff. */
      curve: 1.35,
    },

    /**
     * Post-orgasm sensitivity window (“orgasm duration” for overstim).
     * High intensity on hypersensitive parts, or a rapid re-climax inside the
     * window, builds phys discomfort — partner-overwhelm self-critique.
     */
    postOrgasm: {
      durationBaseSeconds: 9,
      durationPerPriorSeconds: 3.5,
      durationCapSeconds: 24,
      /** Intensity at or above this on a hypersens target writes overstim phys. */
      overstimIntensityFloor: 4.2,
      /** Phys/sec at intensity 5 on a hypersens target during the window. */
      overstimPhysPerSecAtIntensity5: 5.2,
      /** Flat phys spike when climaxing again while still in the window. */
      rapidClimaxPhysSpike: 16,
    },

    /** Base arousal drop on climax; further climaxes drop less (more wrecked/open). */
    climaxArousalDrop: 38,
    climaxArousalDropPerPrior: 6,
    climaxArousalDropFloor: 14,
    /**
     * Post-climax edge floor — must stay well below climaxTip.minEdge so the
     * next tip requires rebuilding edge (prevents every-second Lab re-tips).
     */
    climaxEdgeReset: 5,
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
    /**
     * Phys-only damp on arousal/edge gain. Psych uses psychContinuum gainMult
     * (coexistence until overwhelm) instead of a hard mutual exclusion.
     */
    discomfortDampPhysK: 1.1,
    /**
     * @deprecated psych damp replaced by psychContinuum; kept so old readers
     * don’t crash. Prefer psychContinuum.gainMult*.
     */
    discomfortDampPsychK: 0.35,
    /** @deprecated use dampPhys / psychContinuum */
    discomfortDampK: 1.1,

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
   * Desire is the main deep-intimacy unlock; trust/affection alone should not
   * clear genital play (warm ≠ lovers).
   */
  bond: {
    trustWeight: 0.3,
    affectionWeight: 0.3,
    /** Interest / Desire — large share of intimacy budget. */
    desireWeight: 0.55,
    familiarityWeight: 0.1,
    warmthBonus: 10,
    desireHeatBonus: 16,
    hurtPenalty: 22,
    irritationPenalty: 12,
    suspicionPenalty: 18,
    guiltPenalty: 8,
    /** Added to weighted bond sum before comparing to required intimacy. */
    budgetSlack: 11,
    /** intimacyRequired × this vs budget (higher = stricter). */
    requirementScale: 0.95,
    /**
     * Flat budget demand added when the target is genital/anal.
     * Separates breast/mouth warmup (warm OK) from groin (needs lovers-tier desire).
     */
    genitalBudgetSurcharge: 52,
    /**
     * Encounter-local “melting resolve” / mind-going-blank: temporary intimacy
     * budget credit from climaxCount. Does not write long-term Desire.
     */
    resolveMelt: {
      creditFirstClimax: 18,
      creditPerExtraClimax: 11,
      creditCap: 48,
    },
    /**
     * Body-commit on intimacy objection: mind refuses, but high encounter
     * arousal lets physical contact still drive physio / edge / wetness
     * (“too late — body already answering”). Cold arousal → little/no body reply.
     */
    bodyCommit: {
      /** Below: intimacy-blocked contact writes almost no physio. */
      arousalFloor: 28,
      /** At/above: full body-commit physio scale. */
      arousalFull: 64,
      /** Physio mult while objecting at full commit (tense vs willing). */
      physioMult: 0.88,
    },
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
    orientationResistanceBudgetTax: 22,
    /**
     * F→F skinship: low–mid affection loci (hand/shoulder/neck/lips) drastically
     * reduce orientation resistance so Desire soft-cap does not block the trope.
     * Breast+ (target intimacy above max) still feels the interest gap.
     */
    skinshipActionIntimacyMax: 4.5,
    skinshipTargetIntimacyMax: 6.0,
    /** Multiply orientationResistance for skinship-tier acts (0 = ignore resist). */
    skinshipOrientationResistMult: 0.12,
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
    /**
     * Felt / orifice gate for genital flush notes. Secretion is arousal-gated;
     * this only flavors when cloth weep is notable.
     */
    ambientWetnessThreshold: 0.55,
    /**
     * Felt readiness = ambient floor (+ lust nudge) + orifice accumulation.
     * Encounter arousal gates secretion; it does not add felt directly.
     */
    arousalWetness: {
      /** Mild felt floor nudge at standing lust = 100. */
      lustFloorNudgeMax: 0.08,
      /** @deprecated alias — use lustFloorNudgeMax */
      lustBoostMax: 0.08,
      /** @deprecated encounter no longer adds felt directly */
      encounterBoostMax: 0,
      /** Reserved desire / mood floor nudge. */
      desireMoodBoostMax: 0.04,
      /** orificeSlick.vagina wet01 → felt headroom above floor. */
      secretedToFeltMult: 1.0,
    },
    /**
     * Cycle lubrication *rate* mult (not readiness). Moderate fertile advantage.
     */
    lubricationRate: {
      byMucus: {
        bloody: 0.55,
        scarce: 0.45,
        sticky: 0.7,
        eggWhite: 1.15,
        cloudy: 0.75,
        dry: 0.4,
      } as Record<string, number>,
      crestBonus: 0.35,
      estrogenBonusCap: 0.12,
      rateMin: 0.35,
      rateMax: 1.55,
    },
    /**
     * Arousal-gated vaginal secretion → orificeSlick.vagina (fluid truth).
     * Cloth weep is a share of produced volume.
     */
    vaginalSecretion: {
      baseSecretePerSec: 0.012,
      secreteArousalBelow: 22,
      secreteArousalFull: 68,
      genitalSecreteMult: 2.4,
      nonGenitalSecreteMult: 0.55,
      orificeRetainShare: 0.72,
      lustTricklePerHourAtCap: 0.04,
      lustTrickleBelow: 28,
    },
    /**
     * ♀ climax fluid volume (one truth) → orifice + cloth shares.
     */
    femaleClimaxFluid: {
      volumeBase: 0.22,
      edgeVolumeWeight: 0.85,
      arousalVolumeWeight: 0.35,
      cycleVolumeWeight: 0.4,
      orificeVolumeWeight: 0.2,
      volumeMin: 0.08,
      volumeMax: 1.35,
      orificeShare: 0.45,
      clothShare: 0.7,
      fatiguePerPrior: 0.12,
      fatigueFloor: 0.35,
      surgeModestBelow: 0.35,
      surgeStrongBelow: 0.75,
    },
    /**
     * Idle weep from orifice pool / felt (consequence of fluid present).
     * Guardrail: peak ready should not fill underwear in under ~8h idle.
     */
    arousalDrip: {
      soilFromWetnessThreshold: 0.42,
      amountPerHourAtCap: 0.12,
    },
    /**
     * Legacy scene soil flavor gates; primary in-scene cloth damp is secretion weep.
     */
    sceneArousalSoil: {
      soilFromWetnessThreshold: 0.42,
      dripPerSecAtCap: 0.004,
      qualityWeight: 0.25,
      genitalBonusBase: 0.0175,
      genitalBonusCap: 0.0275,
      flavorRate: {
        slick: 0.0006,
        beading: 0.0018,
        dampening: 0.004,
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
      /**
       * Bare-skin surface film — does not soak into flesh.
       * Free-running only on uncovered skin; under wet cloth, skin is contact-wicked
       * (tacky smear co-located with soaked regions — does not run further).
       */
      skinDrip: {
        /** Max wet points of surface film per skin region before forced runoff. */
        filmCapacity: 14,
        /** Fraction of a bare deposit that sticks as film vs immediate runoff. */
        filmStickShare: 0.35,
        /** Per-apply runoff cap amount01 along the bare-skin chain. */
        maxRunoffPerApply01: 0.25,
        /** Idle hours: fraction of *running* film wet that migrates down per hour. */
        migratePerHour: 1.8,
        /** Fraction of calf runoff that leaves the body (drip off). */
        dripOffShare: 0.55,
        /**
         * Share of cloth-region stick that wicks onto co-located skin as tacky smear.
         * Skin under pants only damps where the garment is wet.
         */
        clothWickToSkinShare: 0.22,
        /** Share of garment wet transferred to skin as tacky smear on unequip. */
        undressTransferShare: 0.55,
        /** Tacky smear evaporates in place (no downhill migrate). */
        tackyEvaporatePerHour: 0.55,
        /**
         * Anal verge dwell — lasting pool captured from lying/seated seat-trail
         * even when runoff flashes past to cleft/cheek/bed.
         */
        vergeDwellShare: 0.4,
        /** Max wet points held at the anal verge (above seat filmCapacity). */
        vergeCapacity: 24,
        /**
         * Verge pool dry-out — exposed biological film (minutes), not cloth soak.
         * ~4.0 → half-life ~10 min; aligns with orificeSlick vaginalSecretion.
         */
        vergeEvaporatePerHour: 4.0,
        /** Semen at the verge dries faster still (poor/short-lived). */
        vergeSemenEvaporateMult: 1.35,
        /**
         * When verge is full, fraction of rejected dwell that bleeds onto seat film
         * (cleft/cheek/bed story) instead of vanishing.
         */
        vergeOverspillToSeatShare: 1,
      },
      /**
       * Mounted / cowgirl: share of her overflow reserved for partner crotch cloth.
       * Full partner routing still stubby — amount is computed and optionally applied.
       */
      partnerDripShareMounted: 0.55,
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
