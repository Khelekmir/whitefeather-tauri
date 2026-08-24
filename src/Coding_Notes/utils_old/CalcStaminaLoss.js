import { staminaCosts } from "./CombatConfig";
import { bodypartHealthCombatModifiers } from "./CombatConfig";

export function calcStaminaLoss(attacker, defender, action, equipmentWeight, attackBodypartHit = "miss") {
    const bodypartHealth = attackBodypartHit !== "miss" ? defender.combatStats.itemizedHealth[attackBodypartHit]?.health || 1 : 1;
    const dodgeInfluenceModifier = bodypartHealthCombatModifiers.dodgeChance[attackBodypartHit] || 0.5;

    const lowestHealth = Math.min(...Object.values(defender.combatStats.itemizedHealth).filter(h => h.bodypart === "anus" || h.bodypart === "groin" || h.bodypart === "hipLeft" || h.bodypart === "hipRight" || h.bodypart === "buttockLeft" || h.bodypart === "buttockRight" || h.bodypart === "thighInnerLeft" || h.bodypart === "thighInnerRight" || h.bodypart === "thighOuterLeft" || h.bodypart === "thighOuterRight" || h.bodypart === "kneeLeft" || h.bodypart === "kneeRight" || h.bodypart === "lowerLegLeft" || h.bodypart === "lowerLegRight" || h.bodypart === "footLeft" || h.bodypart === "footRight").map(h => h.health));

    const adjustedDodgeInfluence = 1 - ((1 - lowestHealth) * dodgeInfluenceModifier);

    const squareDiff = Math.sqrt(attacker.combatStats.base.constitution / defender.combatStats.base.constitution);

    switch (action) {
        case "attack":
            return staminaCosts.attack.basic * Math.max(1, (1 + (equipmentWeight / attacker.weight) - 0.25));
        case "attackDodge" || "attackAvoid":
            return staminaCosts.dodge / Math.max(0.3, adjustedDodgeInfluence);
        case "attackParry":
            return staminaCosts.parry * squareDiff;
        case "attackBlocked":
            return staminaCosts.block * squareDiff;
        case "attackHit":
            return staminaCosts.takeDamage * squareDiff * bodypartHealth;
        default:
            return 0
    }
}
