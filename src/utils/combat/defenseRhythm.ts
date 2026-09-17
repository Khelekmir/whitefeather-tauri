import type { Unit as DetailedUnit } from '../../types/characters';
import type { Item } from '../../types/items';
import { getItemTemplate } from '../../data/catalog/itemTemplates';
import { COMBAT_TUNING } from './combatTuning';
import {
  evaluateStanceMatchupFromSkills,
  type StanceMatchupResult,
} from './calcStanceMatchup';
import type { RhythmWindow } from './attackRhythm';
import { calcBloodCombatPenalties, getBloodStatus } from './bloodVolume';
import { calcPerformanceFromItemized } from './performanceFromItemized';

export type DefenseVerb = 'dodge' | 'parry';

const D = () => COMBAT_TUNING.defenseRhythm;

export function canParryWith(
  unit: DetailedUnit,
  itemsById: Record<string, Item>
): boolean {
  const id = unit.equipment.mainhand;
  if (!id) return false;
  const item = itemsById[id];
  if (!item || item.itemType !== 'weapon') return false;
  if (item.durability <= 0) return false;
  if (item.material === 'body' || item.material === 'unequipped') return false;
  return true;
}

export interface ScaleDefenseRhythmInput {
  verb: DefenseVerb;
  defender: DetailedUnit;
  itemsById: Record<string, Item>;
  attacker: DetailedUnit;
  attackerItemsById: Record<string, Item>;
}

/**
 * Build a RhythmWindow for player Dodge / Parry QTE.
 */
export function scaleDefenseRhythmWindow(
  input: ScaleDefenseRhythmInput
): { window: RhythmWindow; matchup: StanceMatchupResult } {
  const { verb, defender, attacker, attackerItemsById } = input;
  const tun = D();

  const atkMainId = attacker.equipment.mainhand;
  const atkMain = atkMainId ? attackerItemsById[atkMainId] : null;
  const weaponType =
    atkMain?.weaponType ??
    (atkMain ? getItemTemplate(atkMain.templateId)?.weaponType : undefined) ??
    'unequipped';

  const matchup = evaluateStanceMatchupFromSkills(
    attacker.combatStats.currentStance.strike,
    defender.combatStats.currentStance.cover,
    attacker.combatStats.stanceSkill,
    defender.combatStats.stanceSkill,
    weaponType
  );

  let durationMs: number = tun.durationMs;
  let critBand: number = tun.critBand;
  let hitBand: number = tun.hitBand;

  const cover = defender.combatStats.currentStance.cover;
  const coverParryMult =
    cover === 'coverHigh' ? COMBAT_TUNING.stance.coverHighParryMult : 1;
  const coverDodgeMult =
    cover === 'coverLow' ? COMBAT_TUNING.stance.coverLowDodgeMult : 1;

  if (verb === 'parry') {
    const pf = matchup.parryWindowFactor;
    const bandScale = 1 - (1 - pf) * tun.parryWindowInfluence;
    critBand *= bandScale;
    hitBand *= bandScale;
    // Low parry window → faster collapse
    durationMs = Math.round(durationMs * (0.75 + 0.25 * pf));
    // coverHigh: inherent parry ease (~+10% bands & duration)
    critBand *= coverParryMult;
    hitBand *= coverParryMult;
    durationMs = Math.round(durationMs * coverParryMult);
  } else {
    // Dodge: easier base
    critBand *= tun.dodgeBandEase;
    hitBand *= tun.dodgeBandEase;
    durationMs = Math.round(durationMs * tun.dodgeDurationEase);
    // coverLow: inherent dodge ease (~+10% bands & duration)
    critBand *= coverDodgeMult;
    hitBand *= coverDodgeMult;
    durationMs = Math.round(durationMs * coverDodgeMult);

    const perf = calcPerformanceFromItemized(defender.combatStats.itemizedHealth);
    const blood = getBloodStatus(defender);
    const bloodPen = calcBloodCombatPenalties(blood.remainingFraction);
    const mobilityEffective = Math.max(
      0,
      Math.min(1, perf.dodge * bloodPen.dodge)
    );
    const mobScale =
      tun.dodgeMobilityFloor + (1 - tun.dodgeMobilityFloor) * mobilityEffective;
    critBand *= mobScale;
    hitBand *= mobScale;

    const av = matchup.avoidanceDelta;
    if (av >= 0) {
      durationMs = Math.round(durationMs * (1 + av * tun.avoidanceEase));
      const b = 1 + av * tun.avoidanceBand;
      critBand *= b;
      hitBand *= b;
    } else {
      durationMs = Math.round(
        durationMs / (1 + Math.abs(av) * tun.avoidanceHaste)
      );
      const b = 1 - Math.abs(av) * tun.avoidanceTighten;
      critBand *= Math.max(0.35, b);
      hitBand *= Math.max(0.35, b);
    }
  }

  const window: RhythmWindow = {
    durationMs: Math.max(350, durationMs),
    startScale: tun.startScale,
    endScale: tun.endScale,
    critBand: Math.max(0.015, critBand),
    hitBand: Math.max(0.04, hitBand),
    rotationDegrees: tun.rotationDegrees,
    critAttackMultiplier: 1,
    windowFactor: verb === 'parry' ? matchup.parryWindowFactor : 1,
    competence: 1,
  };

  return { window, matchup };
}
