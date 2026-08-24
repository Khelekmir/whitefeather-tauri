import { weaponTypes, equipmentMaterial, equipmentKeys } from './CombatConfig';

const unarmedAttacks = [
    "punch",
    "kick",
    "strike",
    "scratch",
    "slap"
]

export function getWeaponSkill(combatStats, weaponType) {
    if (unarmedAttacks.includes(weaponType)) return combatStats.weaponSkill.unequipped;
    return combatStats.weaponSkill[weaponType]
}