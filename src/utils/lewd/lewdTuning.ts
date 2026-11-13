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

    /**
     * ♂ arousal / readiness vs shared rates. Edge uses the shared edgeGainPerSec
     * (no male mult) so firmness + mental heat outrun tip-building.
     */
    male: {
      /** Base encounter arousal gain mult (receiving or giving). */
      arousalGainMult: 1.75,
      /**
       * Extra mult when this beat is proactive giving (stacks with base).
       * Giving is quality-poorer than receiving on soft paths — this closes the gap.
       */
      proactiveArousalGainMult: 1.55,
      /**
       * Scales proactive giver psych/physio quality up (hands/kiss give less
       * raw physio than being touched; ♂ still heats from initiating).
       */
      proactiveQualityMult: 1.35,
      /** Stronger early-touch novelty than the shared ♀-leaning curve. */
      noveltyBoostMax: 1.5,
      noveltyArousalBelow: 26,
      /**
       * Scales proactive pushRequiredArousal down — men get mentally ready
       * to escalate sooner than the shared push curve.
       */
      pushRequiredArousalMult: 0.55,
      /**
       * Extra softCap headroom — giver erogenous is often lower than receiving
       * (hands/kiss vs being touched), so ♂ mental heat would otherwise plateau early.
       */
      softCapBonus: 24,
    },

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
     * ♂ encounter-local erection + pre-ejaculate (mirrors ♀ wetness erotic reward).
     * Erection tracks arousal quickly from light stim; precum beads tiny cloth
     * spots (coin-capped) unless he climaxes into under/underneath genital clothes.
     */
    maleErection: {
      /** Arousal below: target firmness ~0 / decay. Light touch starts swell. */
      arousalOnset: 8,
      /** Arousal at/above: approach full erection (ahead of tip-building). */
      arousalFull: 36,
      /** Edge share toward firmness target — keep low so edge stays slow. */
      edgeFirmWeight: 0.08,
      /** Approach rate toward target firmness /sec (brief stim → firm). */
      risePerSec: 0.52,
      /** Fall rate when target drops / idle. */
      fallPerSec: 0.16,
      /** Extra fall mult while refractory. */
      refractoryFallMult: 2.8,
      /** Firmness bands for Lab / prose (erection01 thresholds). */
      bandSwelling: 0.18,
      bandFirm: 0.5,
      bandRigid: 0.8,
      precum: {
        /** Need at least this erection01 to bead. */
        minErection01: 0.32,
        secreteArousalBelow: 38,
        secreteArousalFull: 75,
        baseBeadPerSec: 0.0032,
        genitalBeadMult: 2.1,
        nonGenitalBeadMult: 0.5,
        /**
         * Soft cap on underwear semen-channel wet score from precum this scene.
         * coin band is &lt;28 — stay at/under a small coin.
         */
        clothScoreCap: 22,
        beatQualityWeight: 0.25,
      },
      clothedClimax: {
        /** Own-cloth volume share when climax + genital under/underneath. */
        dumpVolumeShare: 0.92,
        /** Tiny own-cloth leak when climax while exposed / over / displace. */
        exposedLeakShare: 0.15, // increased from 0.6 to 0.15 manually
      },
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
    /**
     * Lover-coax (arousal-only): affection+desire (trust soft) keep arousal
     * climbing while psych is high, if phys &lt; physCeiling. Dies at psych
     * hard-cap. Does not unlock acts; does not raise edge/tip or giver coax.
     */
    loverCoax: {
      affectionWeight: 0.45,
      desireWeight: 0.4,
      trustWeight: 0.15,
      desireHeatWeight: 0.08,
      hurtPenalty: 0.22,
      suspicionPenalty: 0.16,
      /** Coax relief only while phys discomfort below this. */
      physCeiling: 50,
      /** Smooth drop starting this many points below physCeiling. */
      physTaperSpan: 8,
      /** Max gain floor at psych≈0 for coaxAffinity=1. */
      coaxFloorAtClear: 0.88,
      /**
       * pow(1 − psych/hardCap, this). Sub-linear (~0.4) so lovers still
       * warm through strain/overwhelm; floor hits 0 at hard-cap.
       */
      coaxPsychTaperPower: 0.4,
      /**
       * Fraction of overwhelm decay suppressed by full coax while below the
       * break-approach band (1 = full suppress at coax=1).
       */
      decaySuppress: 0.92,
      /**
       * Psych points below hard-cap where overwhelm decay ramps back in
       * even for high coax (so max-out still drains).
       */
      breakApproachSpan: 12,
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
   * Clothing barriers for lewd contact (over / under / underneath / displace).
   * Soft layers attenuate physio and ease intimacy requirement; hard armor blocks skin/orifice.
   * `underneath` = displace-tier contact without garment displace (cloth soils as worn).
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
     * Overworld (Pass-Time) discharge streams — not encounter arousal.
     * Leukorrhea / sleep pool / menstrual curve. Sweat deferred (whole-body later).
     * See memory topic whitefeather-overworld-wetness.md.
     */
    overworldDischarge: {
      /**
       * Baseline leukorrhea volume01/h at mucus mult 1.0 and trait mult 1.0.
       * eggWhite (~1.45×) over ~8–12h → toward coin damp without arousal.
       */
      leukorrheaBasePerHour: 0.028,
      /** Share of leukorrhea retained as light orifice film (rest → cloth). */
      leukorrheaOrificeRetainShare: 0.18,
      /** Mucus-band mults on leukorrhea production. */
      leukorrheaByMucus: {
        bloody: 0.15,
        scarce: 0.35,
        sticky: 0.75,
        eggWhite: 1.45,
        cloudy: 0.7,
        dry: 0.25,
      } as Record<string, number>,
      /**
       * Cloth mult while sleeping / recumbent (pooling at introitus).
       * Does not raise menstrual blood rate.
       */
      sleepPoolMult: 1.55,
      /**
       * Peak menstrual fluid volume01/h (day-curve × menstrualFlowMult).
       * Day curve averages ~0.7 over a 5-day bleed → total near prior flat 0.08×120.
       */
      menstrualPeakPerHour: 0.11,
      /**
       * Bleed-day intensity curve keyed by floor(cycle day) while menstrual/bloody.
       * Index 0 = first bleed day; last entry repeats for longer bleeds.
       */
      menstrualDayCurve: [1.15, 1.0, 0.72, 0.42, 0.22, 0.1],
      /**
       * Default period-cloth absorb capacity in soil points (wet-score family).
       * ~40 ≈ several hours of average flow before change-out / bleedthrough.
       * Catalog items will override. Bleedthrough → underwear blood when full.
       */
      periodClothDefaultCapacity: 40,
      /** Underwear blood intensity at/above this reads as visible bleedthrough stain. */
      bleedThroughVisibleAt: 12,
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
       * Amount is computed; applying it to the partner unit is Lab/posture-optional
       * (scene tags + full partner soil routing still thin).
       */
      partnerDripShareMounted: 0.55,
    },
  },

  /**
   * Solo masturbation: dampened self-stim + solo psych; fantasy restores mental
   * eroticism from eroticMemory (relationship × act intimacy × freshness).
   * Physio stays self-dampened even with vivid fantasy.
   */
  masturbation: {
    /** Hands-on self-stim vs partnered receiving physio. */
    selfPhysioMult: 0.62,
    /** Blank-mind mental eroticism vs partnered-style psych ref. */
    soloPsychMult: 0.42,
    /** Cap on fantasy-boosted psych (does not invent partner touch). */
    fantasyPsychCeil: 0.95,
    /** Witnessed memories weaker than participated. */
    witnessedWeight: 0.72,
    participatedWeight: 1,
    /** Relationship blend for masturbator → imagined partner (sums ≈ 1). */
    relationship: {
      desire: 0.45,
      desireHeat: 0.2,
      affection: 0.18,
      familiarity: 0.12,
      warmth: 0.05,
    },
    /** actIntimacy / this → intimacy01 before curve. */
    intimacyRef: 9,
    /** >1 = deep acts matter more for fantasy. */
    intimacyCurve: 1.15,
    /** Mild same-sex Desire soft-cap dim on fantasy (not a hard block). */
    orientationFantasyMult: 0.55,
    /** Standing lust drop on climax (diminishes with prior climaxes). */
    lustReliefOnClimax: 6,
    lustReliefPerPriorClimax: 0.65,
    lustReliefFloor: 2.5,
    /** Memory freshness horizon (hours). */
    memoryTtlHours: 60,
    /** Freshness curve (>1 = faster late fade). */
    freshnessCurve: 1.2,
    /** Max stored erotic memories per unit. */
    memoryCap: 8,
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
    /**
     * Physio when the *actor* part is bodily (mouth / breast / genital),
     * so kissing feels as physiological when giving as when receiving.
     * Hands/feet still stay psych-led with a small erogenous residual.
     */
    mouthPhysioMult: 1.0,
    breastPhysioMult: 0.92,
    genitalPhysioMult: 1.0,
    /** Residual erogenous share for non-bodily actor parts (hands, etc.). */
    nonBodilyErogenousMult: 0.28,
  },

  /**
   * Event-driven reaction overlay (orgasm clench, later NPC hands).
   * Does not steal player attention budget.
   */
  reactions: {
    /** Max concurrent reaction/NPC overlay channels. */
    softCap: 4,
    /**
     * Flat fallbacks when a reaction fragment is missing / opts override.
     * Authored curves live in lewdReactionPreloads (Phase B).
     */
    orgasmClenchSeconds: 6,
    orgasmClenchIntensity: 7,
    /** Underside wrapping grip runs this many intensity ranks cooler. */
    undersideIntensityDelta: 1,
    /**
     * ♀ climax surge band → clench intensity / duration scale.
     * modest = smaller tip; soaking = full surge.
     */
    surge: {
      modest: { intensityDelta: -1, durationMult: 0.75 },
      strong: { intensityDelta: 0, durationMult: 1 },
      soaking: { intensityDelta: 1, durationMult: 1.25 },
    },
  },

  /**
   * Act lubricant deposits into orificeSlick (saliva / oil live).
   * Deferred: partner precum/semen as act deposits on orifice targets
   * (climax → cloth/cohort path already exists; this is rim/oral pre-load).
   */
  actDeposits: {
    /**
     * Saliva from tongue/lips on orifice targets (rim, lick, tongueProbe, …).
     * amount = base × actionMult × intensity01 × holdScale (capped per beat).
     */
    saliva: {
      /**
       * Comfort uses wet×quality; saliva quality≈0.5 so ~0.24 wet clears
       * analDryThreshold 0.12 — a short rim/probe bout should get there.
       */
      baseAmount01: 0.15,
      /** Scale vs holdSeconds / defaultHoldSeconds (soft). */
      holdScalePower: 0.55,
      intensityDivisor: 10,
      /** Cap total saliva added across all channels in one resolve. */
      perBeatCap01: 0.36,
      actionMult: {
        tongueProbe: 1.35,
        lick: 1.0,
        tongueTrace: 0.95,
        kissTongue: 0.85,
        suckShallow: 0.75,
        suckDeep: 0.9,
        kissLips: 0.45,
      },
    },
    /** Lab / inventory oil apply onto an orifice. */
    oil: {
      refinedAmount01: 0.42,
      improvisedAmount01: 0.32,
    },
  },

  /**
   * ♀ orifice dilation + lubrication comfort (tease → probe → insert).
   * Soft-cap chain: tease → 1 finger → 2 fingers → tip → shaft → full.
   * Jumping the chain dilates faster but spikes recoverable discomfort.
   */
  orificePlay: {
    /**
     * Baseline anal film seeded on ♀ encounter / Lab reset.
     * wet×quality must clear analDryThreshold so soft-cap-prepped tip
     * insert is not dryRefuse on baseline alone (saliva/oil still help).
     */
    analBaselineAmount01: 0.34,
    analBaselineQuality01: 0.42,
    /**
     * Effective comfort wet = wet01 × quality01.
     * Below this, anal insert refuses; probe/tease may continue at verge.
     */
    analDryThreshold: 0.12,
    /** Vaginal dry is softer — felt readiness already helps. */
    vaginalDryThreshold: 0.08,
    /**
     * Soft-cap dilation01 each size class can gently raise toward.
     * Next class becomes comfortable once dilation reaches the prior cap.
     */
    dilationSoftCapBySize: {
      fingertip: 0.28, // tease → ready for 1 finger
      finger: 0.45, // 1 finger → ready for 2
      tongue: 0.45,
      twoFinger: 0.62, // 2 fingers → ready for penis tip
      threeFinger: 0.72, // 3 fingers (cap) → toward tip/shaft
      penisTip: 0.82, // tip → ready for deep shaft
      toyS: 0.82,
      penis: 1.0, // deep shaft → full
      toyM: 1.0,
      toyL: 1.0,
    },
    /**
     * Approach rate toward soft cap while coaxing / accepting (/sec).
     * Slow on purpose: good-terms anal needs sustained correct prep
     * (tease → finger → two → tip → deep), not a short coax beat.
     */
    softCapApproachPerSec: 0.014,
    /**
     * Jumping the chain: only mildly faster than gentle coax (/sec).
     * Rough play still opens, but is not a shortcut past patient prep —
     * the cost is sharp recoverable phys, not rapid capacity.
     */
    jumpDilationPerSec: 0.02,
    /** Idle close rate when no orifice contact (scaled with slow coax). */
    dilationFadePerSec: 0.0035,
    /**
     * Mild phys while gently stretching toward the soft cap (eases if you stay
     * at/below capacity once opened).
     */
    gentleStretchPhysPerSec: 1.4,
    /** Extra phys decay credit /sec while accepting at/below soft cap. */
    settlePhysReliefPerSec: 2.2,
    /** Stretch fatigue while gently opening (small). */
    gentleStretchFatiguePerSec: 0.03,
    /** Stretch fatigue decay while settled at/below soft cap. */
    settleFatigueDecayPerSec: 0.06,
    /** Idle / forcing fatigue decay (slower). */
    stretchFatigueDecayPerSec: 0.02,
    /** Phys /sec per size-rank jumped past open capacity (surprise finger ≈ 1). */
    jumpPhysPerSecPerRank: 3.2,
    /** Cap on jump phys so surprise stays sharp but not instant ruin. */
    jumpPhysPerSecCap: 11,
    /** Jump quality crush (still allows pleasure to return as distress settles). */
    jumpQualityMult: 0.42,
    /** Plug seed dilation when Lab/scene starts with held anal plug. */
    analPlugSeedDilation01: 0.55,
    analPlugSizeClass: 'toyS' as const,
    /**
     * openCapacity ≈ dilation01 mapped through these rank breakpoints.
     * Ranks: fingertip1 · finger2 · twoFinger3 · threeFinger4 · tip5 · penis7 · toyL9.
     */
    capacityAtDilation: [
      { dilation01: 0, rank: 1 },
      { dilation01: 0.28, rank: 2 },
      { dilation01: 0.45, rank: 3 },
      { dilation01: 0.55, rank: 4 },
      { dilation01: 0.62, rank: 5 },
      { dilation01: 0.82, rank: 7 },
      { dilation01: 1.0, rank: 9 },
    ],
    /** Probe may be this many ranks over capacity before counting as a jump. */
    probeFitSlack: 0.35,
    /** Insert fit slack (tip at exact capacity stays accepting). */
    insertFitSlack: 0.15,
    /** Intensity ≥ this (1–10) counts as sudden when jumping. */
    suddenIntensityFloor: 5,
    /** Phys discomfort /sec when forcing without counting as dry refuse. */
    forcePhysPerSec: 6.5,
    /** Phys /sec when attempting dry anal insert (on top of refuse). */
    dryRefusePhysPerSec: 9,
    /** Psych share of orifice phys chips (threat / reluctance). */
    forcePsychShare: 0.55,
    dryPsychShare: 0.75,
    jumpPsychShare: 0.62,
    /** Quality mult when coaxing / accepting / forcing / dryRefuse. */
    qualityMult: {
      coaxing: 1.08,
      accepting: 1.0,
      forcing: 0.32,
      dryRefuse: 0.05,
    },
    /**
     * Anal rubbed-raw fatigue (encounter-local raw01) → itemizedHealth.anus tear.
     * Dryness is the primary stressor; forced oversize has exponential returns.
     * Well-lubed coaxed play barely accumulates.
     */
    analRaw: {
      /** (1 − lubeComfort01)^power — primary stressor. */
      dryStressPower: 1.7,
      dryStressWeight: 1.15,
      /**
       * Size ranks at/below this (finger = 2) only lightly raw the anus.
       * Finger-scale ignores size/jump stress — dryness × intensity only.
       * Serious fatigue scales above finger probe.
       */
      mildSizeRankMax: 2,
      /** Stress mult on dry×band×intensity while sizeRank ≤ mildSizeRankMax. */
      mildSizeMult: 0.08,
      /**
       * Above mildSizeRankMax: ramp toward full size/jump stress.
       * overMild = sizeRank − mildSizeRankMax; mult = min(1, (overMild / span)^power).
       */
      sizeSeriousSpan: 1.75,
      sizeSeriousPower: 0.95,
      /** Size ranks over open capacity: (base^(over×exp)) − 1. */
      sizeOverBase: 1.22,
      sizeOverExp: 1.55,
      /** Jump steps: (1 + extra)^(jumpSteps×exp) − 1. */
      jumpExtra: 0.42,
      jumpExp: 1.35,
      /**
       * Intensity 1–10 → stress mult.
       * Low intensity stays gentle; high intensity hits hard.
       * mult = floor + (1−floor)×(intensity/10)^power
       */
      intensityFloor: 0.18,
      intensityPower: 1.45,
      /** Band force mult on total stress. */
      bandMult: {
        tease: 0.06,
        coaxing: 0.14,
        accepting: 0.1,
        forcing: 1.0,
        dryRefuse: 1.4,
      },
      /** raw01 gained per second at stress = 1. */
      rawPerSecAtRef: 0.11,
      /** Cap stress before × rate (keeps one beat from insta-max except worst cases). */
      stressCap: 4.5,
      /**
       * When lube ≥ this and fit is in-chain (accepting/coaxing), multiply stress
       * by lubedAcceptingMult so skilled prep barely raws.
       */
      lubeSafeFloor: 0.28,
      lubedAcceptingMult: 0.045,
      /** Decay while accepting/coaxing with decent lube. */
      rawDecayPerSecSoothing: 0.014,
      /** Idle fade (no anal contact). */
      rawDecayPerSecIdle: 0.007,
      /** High raw adds phys discomfort (/sec at raw=1). */
      rawPhysPerSecAtFull: 3.2,
      /** Quality crush from raw (at raw=1). */
      rawQualityTaxAtFull: 0.35,
      /** First tear: raw ≥ threshold on a forcing/dryRefuse beat. */
      tearRawThreshold: 0.88,
      /** Health subtracted from itemizedHealth.anus on first tear. */
      tearHealthLoss: 0.22,
      /** Bleed split on tear (external-heavy tearing). */
      tearBleedExternal: 0.78,
      tearBleedInternal: 0.22,
      /** Extra phys spike on the tear beat. */
      tearPhysSpike: 10,
      /** Further dry-forcing at raw≥aggravateRaw floors more health/sec. */
      aggravateRawFloor: 0.95,
      aggravateHealthPerSec: 0.04,
    },
    /**
     * Vaginal rubbed-raw (more forgiving than anal — designed for penetration).
     * Vaginal secretion is excellent lube; attentive foreplay barely raws.
     * Dry + forced still punished → itemizedHealth.groin tear.
     */
    vaginalRaw: {
      dryStressPower: 2.05,
      dryStressWeight: 0.9,
      /** Tip-scale and below stay mild when not jumping hard. */
      mildSizeRankMax: 5,
      mildSizeMult: 0.06,
      /** Shaft still stresses, but slower ramp than anal. */
      sizeSeriousSpan: 3.2,
      sizeSeriousPower: 1.05,
      sizeOverBase: 1.16,
      sizeOverExp: 1.35,
      jumpExtra: 0.32,
      jumpExp: 1.2,
      intensityFloor: 0.22,
      intensityPower: 1.35,
      bandMult: {
        tease: 0.04,
        coaxing: 0.1,
        accepting: 0.07,
        forcing: 1.0,
        dryRefuse: 1.25,
      },
      rawPerSecAtRef: 0.07,
      stressCap: 3.6,
      lubeSafeFloor: 0.2,
      /** Strong reward for secretion-ready accepting play. */
      lubedAcceptingMult: 0.028,
      /**
       * Extra stress damp when comfort is largely natural secretion / felt wet
       * (body-intended lube). Dry forced play does not get this.
       */
      secretionComfortFloor: 0.28,
      secretionForgivenessMult: 0.42,
      rawDecayPerSecSoothing: 0.02,
      rawDecayPerSecIdle: 0.01,
      rawPhysPerSecAtFull: 2.4,
      rawQualityTaxAtFull: 0.28,
      tearRawThreshold: 0.9,
      tearHealthLoss: 0.16,
      tearBleedExternal: 0.7,
      tearBleedInternal: 0.3,
      tearPhysSpike: 7.5,
      aggravateRawFloor: 0.95,
      aggravateHealthPerSec: 0.028,
    },
  },

  defaultHoldSeconds: 8,
} as const;
