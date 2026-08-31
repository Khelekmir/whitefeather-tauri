import type { Unit as DetailedUnit } from '../../types/characters';
import {
  getEdge,
  type RelationshipGraph,
} from '../social/relationshipState';
import { bondFromEdge } from './intimacyBond';
import { erogenousRank } from './erogenous';
import {
  attentionLimbForActorPart,
  type LewdChannel,
} from './lewdChannels';
import { getLewdAction, getLewdBit } from './lewdCatalogAccess';
import { LEWD_TUNING as T } from './lewdTuning';

export interface ProactiveGiverStim {
  psychQuality: number;
  physioQuality: number;
  erogenous: number;
  /** 0–1: desire/lust/arousal willingness to push intimacy. */
  pushWillingness: number;
  /** Soft / hard gate vs deepest channel intimacy. */
  pushReadiness: 'ok' | 'softUnready' | 'hardUnready';
  pushRequiredArousal: number;
}

/**
 * How ready the proactive partner is to *push* intimacy this beat.
 * Low desire + cold arousal → soft/hard unready on deep acts.
 */
export function evaluateProactivePush(
  proactive: DetailedUnit,
  recipient: DetailedUnit,
  channels: LewdChannel[],
  proactiveArousal: number,
  relationships?: RelationshipGraph
): ProactiveGiverStim {
  const edge = relationships
    ? getEdge(relationships, proactive.id, recipient.id)
    : null;
  const bond = bondFromEdge(edge);
  const lust = Math.max(0.15, (proactive.lewdStats.dynamic.lust || 30) / 60);
  const desireCtx = Math.max(
    0.08,
    (bond.desire / 100) * 0.55 +
      (bond.desireHeat / 100) * 0.25 +
      (bond.affection / 100) * 0.12 +
      lust * 0.35
  );

  let psych = 0;
  let physio = 0;
  let ero = 0;
  let maxActIntimacy = 0;

  for (const ch of channels) {
    const action = getLewdAction(ch.actionId);
    if (!action) continue;
    maxActIntimacy = Math.max(maxActIntimacy, action.intimacy);

    const actorBit = getLewdBit(proactive.sex, ch.actorPart);
    const partRow = proactive.lewdStats.itemizedLewd[ch.actorPart];
    const pref = Math.max(0, Math.min(1, (partRow?.preference ?? 5) / 10));
    const prefInt = partRow?.prefIntensity ?? 4;
    const intensityMatch = Math.max(
      0,
      1 - Math.abs(ch.intensity - prefInt) / 6
    );
    const limb = attentionLimbForActorPart(ch.actorPart);
    const catalogSens = actorBit?.sensitivity ?? 4;
    const sensMult = partRow?.sensitivity ?? 1;
    const rank = erogenousRank(catalogSens * sensMult);

    const givingPsych =
      (0.35 + 0.65 * (action.intimacy / 9)) *
      desireCtx *
      (0.45 + 0.55 * pref) *
      (0.55 + 0.45 * intensityMatch);
    psych = Math.max(psych, givingPsych);

    const genitalActor =
      limb === 'genitals' ||
      /^(penis|vagina|clitoris|mons|testicles)/i.test(ch.actorPart);
    if (genitalActor) {
      const p =
        rank *
        (0.35 + 0.65 * (ch.intensity / 10)) *
        (0.5 + 0.5 * pref) *
        desireCtx;
      if (p > physio) {
        physio = p;
        ero = rank;
      }
    } else {
      // Mouth / hands: mostly psych for the giver; tiny erogenous from lips etc.
      ero = Math.max(ero, rank * 0.28);
    }
  }

  const P = T.proactive;
  const pushWillingness = Math.max(
    0,
    Math.min(
      1,
      desireCtx * P.willingnessDesireWeight +
        (proactiveArousal / 100) * P.willingnessArousalWeight +
        lust * P.willingnessLustWeight
    )
  );

  // Deeper acts need more proactive heat / interest before they "want" to push.
  const pushRequiredArousal = Math.min(
    P.pushArousalCap,
    Math.max(
      0,
      (maxActIntimacy - P.pushSoftActIntimacy) * P.arousalPerActIntimacy
    ) * (1.15 - pushWillingness * 0.4)
  );

  let pushReadiness: ProactiveGiverStim['pushReadiness'] = 'ok';
  if (proactiveArousal + P.pushSoftSlack < pushRequiredArousal) {
    pushReadiness = 'hardUnready';
  } else if (proactiveArousal < pushRequiredArousal) {
    pushReadiness = 'softUnready';
  }

  const gateMult =
    pushReadiness === 'hardUnready'
      ? P.hardUnreadyQualityMult
      : pushReadiness === 'softUnready'
        ? P.softUnreadyQualityMult
        : 1;

  return {
    psychQuality: Math.min(1.15, psych * gateMult),
    physioQuality: Math.min(1, physio * gateMult),
    erogenous: ero,
    pushWillingness,
    pushReadiness,
    pushRequiredArousal,
  };
}
