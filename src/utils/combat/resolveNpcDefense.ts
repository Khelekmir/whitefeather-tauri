import type { Unit as DetailedUnit } from '../../types/characters';
import type { Item } from '../../types/items';
import {
  calcDefenseChancesVsAttacker,
  type DefenseChances,
} from './calcDefenseChances';
import { calcDodgeStamina, calcParryStamina } from './calcStaminaLoss';
import { roundToThousandths } from './penalties';
import type { FighterState } from './resolveBasicAttack';
import { calcTraumaPenalties } from './traumaFlags';

export type NpcDefenseOutcome = 'dodge' | 'parry' | 'none';

export interface NpcDefenseResult {
  outcome: NpcDefenseOutcome;
  chances: DefenseChances;
  /** Defender after stamina spend on success; unchanged reference on `none`. */
  defender: FighterState;
  log: string[];
  roll: number;
}

export interface NpcDefenseOptions {
  /** Injected RNG for tests; default Math.random */
  rng?: () => number;
}

function cloneFighter(f: FighterState): FighterState {
  return {
    unit: structuredClone(f.unit) as DetailedUnit,
    itemsById: structuredClone(f.itemsById) as Record<string, Item>,
  };
}

/**
 * NPC chance-based defense gate (old CombatEngine order: dodge, else parry).
 * Independent rolls: dodge first; if it fails, separate parry roll.
 * On success: spend defender stamina, no damage path.
 * On none: caller proceeds to resolveBasicAttack.
 */
export function resolveNpcDefense(
  attackerIn: FighterState,
  defenderIn: FighterState,
  opts: NpcDefenseOptions = {}
): NpcDefenseResult {
  const rng = opts.rng ?? Math.random;
  const chances = calcDefenseChancesVsAttacker(defenderIn, attackerIn);
  const log: string[] = [];

  const trauma = calcTraumaPenalties(
    defenderIn.unit.combatStats.itemizedHealth
  );
  const dodgeRoll = rng();
  if (dodgeRoll < chances.dodge) {
    const defender = cloneFighter(defenderIn);
    const cost = calcDodgeStamina('precise', trauma.staminaDrainMult);
    const b = defender.unit.combatStats.base;
    b.staminaCurrent = Math.max(
      0,
      roundToThousandths(b.staminaCurrent - cost)
    );
    log.push(
      `${defender.unit.name} dodges ${attackerIn.unit.name}'s attack (p=${chances.dodge.toFixed(2)}, roll=${dodgeRoll.toFixed(2)}). Stamina −${cost} → ${b.staminaCurrent}.`
    );
    return {
      outcome: 'dodge',
      chances,
      defender,
      log,
      roll: dodgeRoll,
    };
  }

  const parryRoll = rng();
  const mainId = defenderIn.unit.equipment.mainhand;
  const mainhand = mainId ? defenderIn.itemsById[mainId] : null;
  if (
    parryRoll < chances.parry &&
    chances.parry > 0 &&
    mainhand &&
    mainhand.durability > 0
  ) {
    const defender = cloneFighter(defenderIn);
    const cost = calcParryStamina({
      quality: 'clean',
      attackerCon: attackerIn.unit.combatStats.base.constitution,
      defenderCon: defender.unit.combatStats.base.constitution,
      staminaDrainMult: trauma.staminaDrainMult,
    });
    const b = defender.unit.combatStats.base;
    b.staminaCurrent = Math.max(
      0,
      roundToThousandths(b.staminaCurrent - cost)
    );
    log.push(
      `${defender.unit.name} parries ${attackerIn.unit.name}'s attack (p=${chances.parry.toFixed(2)}, roll=${parryRoll.toFixed(2)}). Stamina −${cost} → ${b.staminaCurrent}.`
    );
    return {
      outcome: 'parry',
      chances,
      defender,
      log,
      roll: parryRoll,
    };
  }

  log.push(
    `${defenderIn.unit.name} fails to dodge/parry (dodge p=${chances.dodge.toFixed(2)}, parry p=${chances.parry.toFixed(2)}).`
  );
  return {
    outcome: 'none',
    chances,
    defender: defenderIn,
    log,
    roll: dodgeRoll,
  };
}
