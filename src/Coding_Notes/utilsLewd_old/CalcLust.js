export const incrementLustByTime = (currentLust, libido, deltaHours = 1) => { // pure function
    // Simple exponential approach to natural target derived from libido
    const naturalTarget = Math.min(100, Math.pow(libido, 3)); // or your final formula
    const rate = 0.08; // tune this — how fast lust returns to natural level

    const diff = naturalTarget - currentLust;
    const change = diff * (1 - Math.exp(-rate * deltaHours));

    return Math.max(0, Math.min(100, currentLust + change));
};