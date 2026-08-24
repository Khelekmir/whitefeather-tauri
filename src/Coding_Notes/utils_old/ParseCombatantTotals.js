import { calcAttackTotals } from "./AttackTotals";
import { calcDefenseTotals } from "./DefenseTotals";
import { roundToThousandths, weaponTypes } from "./CombatConfig";

export function parseCombatTotals(attacker, defender, isOffhandAttack = false) {
    const attackerAttackTotals = calcAttackTotals(attacker);
    const defenderDefenseTotals = calcDefenseTotals(defender);

    const attackerWeaponTypeUsed = isOffhandAttack
        ? attacker.offhand.combatStats.weaponType
        : attacker.mainhand.combatStats.weaponType
    const defenderWeaponTypeUsed = defender.mainhand.combatStats.weaponType

    const attackerDamageType = weaponTypes[attackerWeaponTypeUsed].damageType;
    const defenderDamageType = weaponTypes[defenderWeaponTypeUsed].damageType; // TODO implement counterattack?

    const combatInputsInitial = {
        attackValueMainhand: attackerAttackTotals.total.attackValueMainhand,
        attackValueOffhand: attackerAttackTotals.total.attackValueOffhand,
        attackBase: attackerAttackTotals.total.attackBase,
        hitChance: attackerAttackTotals.total.hitChance,
        critChance: attackerAttackTotals.total.critChance,
        dodgeChance: defenderDefenseTotals.total.dodge,
        parryChance: defenderDefenseTotals.total.parry,
        blockValue: defenderDefenseTotals.total.blockValue || 0,
        blockChance: defenderDefenseTotals.total.block || 0,
        armorEffectivenessMultiplier: 1
    };
    const combatInputsFinal = applyDamageType(attackerDamageType, combatInputsInitial);

    return combatInputsFinal;
}

// helper functions
function applyDamageType(attackerDamageType, stats) {
    const modified = { ...stats }; // Create a shallow copy to modify

    switch (attackerDamageType) {
        case "melee":
            // No changes
            break;
        case "piercing":
            modified.armorEffectivenessMultiplier *= 0.5;
            modified.dodgeChance *= 1.25;
            break;
        case "chopping":
            modified.dodgeChance *= 0.85;
            modified.parryChance *= 0.85;
            modified.blockValue *= 0.85;
            modified.armorEffectivenessMultiplier *= 0.85;
            modified.hitChance *= 0.85;
            break;
        case "slashing":
            modified.dodgeChance *= 0.5;
            modified.armorEffectivenessMultiplier *= 1.15;
            break;
        case "crushing":
            modified.parryChance *= 0.5;
            modified.blockValue *= 0.5;
            modified.hitChance *= 0.85;
            break;
    }

    return modified;
}