// Sexual Scenario Update Function
import { roundToThousandths } from "../utils/CombatConfig";

// Sexual Scenario Update Function (Updated: Climax based on PNS threshold, no cumulative dose)
export function updateSexualActivation(currentSNS, currentPNS, finalStim, deltaT) {
    // Validate inputs
    if (finalStim < 0 || finalStim > 1) {
        throw new Error("Intensity must be between 0 and 1");
    }
    if (deltaT <= 0) {
        throw new Error("DeltaT must be positive");
    }

    const alphaPNS = 0.4;  // Higher: faster PNS build-up rate, higher peaks; Lower: slower build-up, lower peaks
    const beta = 1.5;      // Higher: more exponential mapping, weaker response to low/moderate intensities; Lower: more linear, stronger response to moderate intensities
    const gammaPNS = 0.03; // Higher: faster PNS decay to baseline, lower sustained levels/peaks; Lower: slower decay, higher sustained levels/peaks

    const alphaSNS = 0.3;  // Higher: faster SNS build-up rate, higher pre-climax plateaus/peaks; Lower: slower build-up, lower plateaus/peaks
    const gammaSNS = 0.03; // Higher: faster SNS decay to baseline, lower sustained levels/peaks; Lower: slower decay, higher sustained levels/peaks

    const climaxThreshold = 5.0; // Higher: requires higher PNS for climax trigger (delays climaxes, allows longer plateaus); Lower: easier trigger (earlier climaxes)
    const orgasmSpike = 4.0;     // Higher: larger SNS increase at climax; Lower: smaller spike
    const pnsDrop = 3.0;         // Higher: larger PNS reduction at climax (longer recovery time between repeats); Lower: smaller drop (quicker potential for repeats)

    // Calculate rates
    const dPNS = alphaPNS * Math.pow(finalStim, beta) - gammaPNS * (currentPNS - 1);
    const dSNS = alphaSNS * Math.pow(finalStim, beta) - gammaSNS * (currentSNS - 1);

    // Provisional updates
    let newPNS = currentPNS + deltaT * dPNS;
    let newSNS = currentSNS + deltaT * dSNS;

    // Check for climax threshold crossing (from below)
    if (newPNS > climaxThreshold && currentPNS <= climaxThreshold) {
        newSNS += orgasmSpike;           // Spike SNS
        newPNS = Math.max(1, newPNS - pnsDrop);  // Drop PNS to simulate decline
    }

    // Clamp
    newSNS = Math.max(1, newSNS);
    newPNS = Math.max(1, newPNS);

    return {
        newSNS: roundToThousandths(newSNS),
        newPNS: roundToThousandths(newPNS)
    };
}

/*

Sexual Scenario Sensitivity

Base: SNS peak = 6.88, PNS max = 6.46, climax time = 26s
alphaPNS high (0.6): PNS max = 9.19 (+42%): Faster PNS build-up, higher peak.
alphaPNS low (0.2): PNS max = 3.73 (-42%): Slower, lower peak.
beta high (2.5): SNS peak = 6.13 (-11%), PNS max = 4.28 (-34%): Less responsive to I=0.6, lower peaks.
beta low (1.0): SNS peak = 7.43 (+8%), PNS max = 8.05 (+25%): More linear, higher peaks for moderate I.
gammaPNS high (0.06): PNS max = 4.06 (-37%): Faster decay, lower peak.
gammaPNS low (0.01): PNS max = 10.39 (+61%): Slower decay, higher peak.
alphaSNS high (0.5): SNS peak = 8.62 (+25%): Faster SNS build-up, higher plateau/peak.
alphaSNS low (0.1): SNS peak = 5.63 (-18%): Slower, lower peak.
gammaSNS high (0.06): SNS peak = 6.51 (-5%): Faster decay, slightly lower peak.
gammaSNS low (0.01): SNS peak = 10.39 (+51%): Slower decay, much higher peak.
climaxThreshold high (15.0): SNS peak = 7.54 (+10%), climax time = 35s (+35%): Delays climax, more SNS build-up time.
climaxThreshold low (5.0): SNS peak = 6.11 (-11%), climax time = 18s (-31%): Earlier climax, less build-up.
orgasmSpike high (6.0): SNS peak = 8.88 (+29%): Directly larger spike.
orgasmSpike low (2.0): SNS peak = 5.49 (-20%): Smaller spike.

Syncope is rarely from SNS alone "maxing out" but from the SNS-PNS switch: 
High SNS (e.g., >5-10x in our normalized scale) creates conditions for PNS 
overcompensation, especially in vulnerable people. For situational awareness, 
envision SNS at 10-20x as a "red zone" where fainting risk escalates if not 
resolved quickly—our models' peaks (8-10x) are moderate, but extending inputs 
could push simulations there. Individual variability is huge; healthy people 
tolerate higher SNS without fainting, while others faint at lower levels due 
to factors like low blood sugar or anxiety.

*/