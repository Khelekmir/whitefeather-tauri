import { calcHealthPenalty } from "./CalcHealthPenalty";
import { equipmentMaterial, roundToThousandths, weaponTypes } from "./CombatConfig";

export function calcWeaponParryLoss(attacker, defender) {
    const attackerWeapon = attacker.mainhand;
    const defenderWeapon = defender.mainhand;

    const atkItemizedHealth = attacker.combatStats.itemizedHealth;
    const atkPwrHlthPenalty = calcHealthPenalty(atkItemizedHealth, "weaponAttackPower");
    const atkStr = attacker.combatStats.base.strength;
    const atkSkl = attacker.combatStats.base.skill;
    const atkWeapSkl = attacker.combatStats.weaponSkill[attackerWeapon.combatStats.weaponType] || 0;
    const atkMatDurability = equipmentMaterial[attackerWeapon.combatStats.material]?.durability || equipmentMaterial.iron.durability;
    const atkSizeMultiplier = weaponTypes[attackerWeapon.combatStats.weaponType].sizeFactor || 1;

    const defItemizedHealth = defender.combatStats.itemizedHealth;
    const defPwrHlthPenalty = calcHealthPenalty(defItemizedHealth, "weaponAttackPower");
    const defStr = defender.combatStats.base.strength;
    const defSkl = defender.combatStats.base.skill;
    const defWeapSkl = defender.combatStats.weaponSkill[defenderWeapon.combatStats.weaponType] || 0;
    const defMatDurability = equipmentMaterial[defenderWeapon.combatStats.material]?.durability || equipmentMaterial.iron.durability;
    const defSizeMultiplier = weaponTypes[defenderWeapon.combatStats.weaponType].sizeFactor || 1;

    const result = {};

    // Basic formula: damage sustained
    const parryConstant = 0.01;

    const atkDurabilityLoss = ((defMatDurability * defSizeMultiplier) / (atkMatDurability * atkSizeMultiplier)) *
        (Math.sqrt((defSkl * defWeapSkl * defStr * defPwrHlthPenalty) / (atkSkl * atkWeapSkl * atkStr * atkPwrHlthPenalty))) *
        parryConstant

    const defDurabilityLoss = ((atkMatDurability * atkSizeMultiplier) / (defMatDurability * defSizeMultiplier)) *
        (Math.sqrt((atkSkl * atkWeapSkl * atkStr * atkPwrHlthPenalty) / (defSkl * defWeapSkl * defStr * defPwrHlthPenalty))) *
        parryConstant

    result.atkDurabilityLoss = atkDurabilityLoss;
    result.defDurabilityLoss = defDurabilityLoss;

    return result;
}