import { bleedModifiers } from "./CombatConfig";

const bleedModifierConstants = {
    "arterial": 10,
    "critical": 5,
    "heavy": 3,
    "light": 1,
    "superficial": 0.3
}

export function calcBleed(character, time = 1) {

    const result = {};

    const itemizedHealth = character.combatStats.itemizedHealth;

    let totalBleed = 0;

    for (const key in itemizedHealth) { // copying over itemized health to itemized bleed

        const area = itemizedHealth[key];

        // placeholder for start bleed
        if (area.health < 1 && area.bleed === 0 && area.bleedMinutes === 0) {
            console.log("bleed was 0, and so was applied");
            area.bleed = 1 - area.health;
        } else if (area.health < 1 && (area.bleed + 0.01 * area.bleedMinutes) > (1 - area.health)) {
            console.log("bleed was greater than health indicated, and so was refreshed");
            area.bleed = 1 - area.health;
        }

        // increment
        if (area.bleed > 0) {
            // time
            area.bleedMinutes += time;
            // bleed
            totalBleed += area.bleed * bleedModifierConstants[bleedModifiers[key]] * time * (area.dressed ? 0.25 : 1) * (area.vulnerary ? 0.25 : 1);
        }

        // decrement
        if (area.bleed > 0 && area.bleedMinutes > 0) {
            // bleedrate
            area.bleed = Math.max(0, area.bleed - 0.01 * area.bleedMinutes);
        }

        // incrementing bleed
        if (area.bleed > 0 && area.bleedMinutes > 0) {
        } else if ("placeholder") {
            // placeholder for end bleed
        }
    }

    result.finalBleed = totalBleed;
    result.itemizedHealth = itemizedHealth;

    return result;

}