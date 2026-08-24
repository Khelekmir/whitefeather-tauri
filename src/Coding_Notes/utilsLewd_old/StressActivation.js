// Stress Scenario Update Function
export function updateStressActivation(currentSNS, currentPNS, intensity, deltaT) {
    // Validate inputs
    if (intensity < 0 || intensity > 1) {
        throw new Error("Intensity must be between 0 and 1");
    }
    if (deltaT <= 0) {
        throw new Error("DeltaT must be positive");
    }

    const alphaSNS = 0.5;  // Higher: faster SNS build-up rate, leading to higher peaks; Lower: slower build-up, lower peaks
    const beta = 2.0;      // Higher: more exponential mapping, weaker response to low/moderate intensities; Lower: more linear, stronger response to moderate intensities
    const gammaSNS = 0.05; // Higher: faster SNS decay to baseline, lower sustained levels/peaks; Lower: slower decay, higher sustained levels/peaks

    const alphaPNS = -0.3; // More negative: stronger/faster PNS suppression (deeper dips); Less negative: weaker/slower suppression (shallower dips)
    const gammaPNS = 0.05; // Higher: faster PNS recovery to baseline after suppression; Lower: slower recovery, more prolonged dips

    // Calculate rates
    const dSNS = alphaSNS * Math.pow(intensity, beta) - gammaSNS * (currentSNS - 1);
    const dPNS = alphaPNS * Math.pow(intensity, beta) - gammaPNS * (currentPNS - 1);

    // Update and clamp
    let newSNS = currentSNS + deltaT * dSNS;
    newSNS = Math.max(1, newSNS);

    let newPNS = currentPNS + deltaT * dPNS;
    newPNS = Math.max(0.2, Math.min(1, newPNS));  // Strong suppression but not below 0.2

    return { newSNS, newPNS };
}