import { useContextStore } from "../ContextStore";
import { buildMinimalPatch } from "./ObjectPatchUtils";

export function changeItemizedHealth(character) {

    const result = {};

    const initCombatStats = character.combatStats;
    let updatedCombatStats = {
        ...character.combatStats
    };

    // remove any instances of character.itemizedBleed

    const patch = buildMinimalPatch(initCombatStats, updatedCombatStats);

    result.id = character.id;
    result.patch = patch;

    console.log("change itemized health called")
    return result
    
    // const result = {};

    // const initCombatStats = character.combatStats;
    // let updatedCombatStats = {
    //     ...character.combatStats,
    //     itemizedHealth: { ...character.combatStats.itemizedHealth }
    // };

    // const itemizedHealth = updatedCombatStats.itemizedHealth;
    // for (const key in itemizedHealth) {
    //     if (!("bleed" in itemizedHealth[key])) {
    //         itemizedHealth[key] = {
    //             ...itemizedHealth[key],
    //             bleed: 0
    //         };
    //     }
    // }

    // const patch = buildMinimalPatch(initCombatStats, updatedCombatStats);

    // result.id = character.id;
    // result.patch = patch;

    // console.log("change itemized health called")
    // return result
}

export default changeItemizedHealth