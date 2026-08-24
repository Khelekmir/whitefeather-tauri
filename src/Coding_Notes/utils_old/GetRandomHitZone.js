export function getRandomHitZone(
    defenderHealthCurrent,
    defenderHealthCap,
    attackTargets,
    attackTargetKey,
    defenderItemizedHealth, // hasn't been implemented yet
    mainhandHit = null
) {
    const target = attackTargets[attackTargetKey];

    if (!target) return null;
    const avoidanceRating = target.avoidanceRating;
    const rand1 = Math.random();

    if (rand1 < avoidanceRating * (defenderHealthCurrent / defenderHealthCap)) {
        return "miss";
    }

    const hitRatios = target.hitRatio;
    const rand2 = Math.random();

    let cumulative = 0;

    for (const [zone, ratio] of Object.entries(hitRatios)) {
        cumulative += ratio;
        if (rand2 < cumulative) {
            if (zone === mainhandHit) return getRandomHitZone(attackTargets, attackTargetKey, mainhandHit);
            return zone;
        }
    }

    // Edge case: due to float rounding errors
    const zones = Object.keys(hitRatios);
    return zones[zones.length - 1];
}