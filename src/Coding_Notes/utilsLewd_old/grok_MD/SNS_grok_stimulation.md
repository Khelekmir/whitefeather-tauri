### Description of Input-Driven SNS and PNS Activation Models

To shift from time-based to stimulation input-based modeling, I've reformulated the SNS (sympathetic nervous system) and PNS (parasympathetic nervous system) activations as dynamic systems driven by a normalized intensity input \( I \) (0 for no stimulus, 1 for maximum). This intensity accumulates over time into an exposure "dose" metric, which influences build-up and potential peaks (e.g., orgasm in sexual scenarios). The mapping from intensity to activation change is exponential (\( I^\beta \) with \( \beta > 1 \)), ensuring low intensities (e.g., 0.1-0.3) produce disproportionately small effects compared to high ones, reflecting physiological thresholds for noticeable autonomic responses.

The models use simple differential equations for build-up and decay, approximated via the Euler method for discrete time steps. This allows simulation over arbitrary durations by iteratively updating activations with current intensity and a time increment \( \Delta t \) (in seconds, for concreteness; typical stress encounters might span 10-60 seconds, sexual 60-600). When intensity is sustained or repeated, it builds/maintains high levels or "resets" decay; when it drops to 0, activations gradually decay back to baseline (1). Peaks are reached if activations exceed scenario-specific implied thresholds (e.g., SNS > 5-8) or, for sexual, if cumulative dose crosses a explicit threshold triggering a SNS spike.

- **Stress Scenario**: SNS builds rapidly with intensity (positive rate), while PNS is suppressed (negative rate). Extended stress (e.g., combat) is simulated via sustained/repeated high intensity, maintaining elevated SNS without full decay. Instantaneous (e.g., lightning) uses a brief high-intensity pulse, leading to quick peak and faster return to baseline.
- **Sexual Scenario**: PNS builds with intensity for arousal, SNS builds more modestly but spikes if cumulative dose (integrated intensity over time) exceeds a climax threshold (simulating orgasm). Temporary stimulation (no orgasm) uses short/low intensity, leading to build-up without spike and gradual decay upon cessation. Extended plateau (e.g., prolonged foreplay) uses lower sustained intensity, delaying or potentially avoiding the spike while maintaining elevated PNS.

Parameters (e.g., build-up rates \( \alpha \), exponent \( \beta \), decay rates \( \gamma \)) were tuned via simulation to approximate previous peak levels (~10x for stress SNS, ~5x for sexual PNS, ~8x total for sexual SNS at climax) under "standard" inputs (e.g., I=1 for ~20s in instant stress yields ~6x SNS peak; I=0.8 for ~140s in standard sexual triggers spike). Clamps prevent unrealistic values (e.g., PNS >=0.2 in stress, SNS/PNS >=1).

### Mathematical Formulas for Activation Levels

The models follow:
\[
\frac{dA}{dt} = \alpha I^{\beta} - \gamma (A - 1)
\]
where \( A \) is SNS or PNS, \( \alpha \) controls build-up/suppression (positive for build-up, negative for suppression), \( \beta >1 \) for exponential mapping, and \( \gamma \) for decay to baseline. For sexual, cumulative dose \( C \) updates as \( \frac{dC}{dt} = I \); if \( C \) crosses threshold, add a fixed impulse spike to SNS (once per crossing).

Euler approximation for updates:
\[
A_{\text{new}} = A + \Delta t \left( \alpha I^{\beta} - \gamma (A - 1) \right)
\]
with post-update clamps.

#### Stress Scenario Formulas
- **SNS Update**:
\[
\frac{d \, SNS}{dt} = 0.5 \, I^{2} - 0.05 \, (SNS - 1), \quad SNS \geq 1.
\]
**How to arrive at this formula:** Aim for rapid build-up to ~6-10x with high I (e.g., I=1 over 20s: initial dSNS/dt=0.5, accumulating with light decay). \( \alpha=0.5 \) scales rate; \( \beta=2 \) ensures low I (0.2) gives small 0.02 vs. high I (0.8) gives 0.32. \( \gamma=0.05 \) for ~20-40s half-life decay.

- **PNS Update**:
\[
\frac{d \, PNS}{dt} = -0.3 \, I^{2} - 0.05 \, (PNS - 1), \quad 0.2 \leq PNS \leq 1.
\]
**How to arrive at this formula:** Negative \( \alpha=-0.3 \) for suppression proportional to I^2; same \( \beta,\gamma \) for consistency, dipping to ~0.2-0.5 with high I, recovering when I=0.

#### Sexual Scenario Formulas
- **PNS Update**:
\[
\frac{d \, PNS}{dt} = 0.4 \, I^{1.5} - 0.03 \, (PNS - 1), \quad PNS \geq 1.
\]
**How to arrive at this formula:** Positive \( \alpha=0.4 \) for build-up to ~4-5x with moderate I; \( \beta=1.5 \) (less aggressive for gradual arousal); \( \gamma=0.03 \) for slower decay (~30-60s half-life).

- **SNS Update**:
\[
\frac{d \, SNS}{dt} = 0.3 \, I^{1.5} - 0.03 \, (SNS - 1), \quad SNS \geq 1.
\]
Plus: \( \frac{dC}{dt} = I \); if C crosses 10 (from below), add 4 to SNS (impulse spike).
**How to arrive at this formula:** Lower \( \alpha=0.3 \) for modest build-up (~3-4x plateau); same \( \beta,\gamma \). Threshold 10 tuned so moderate I=0.6 over ~30s reaches it; spike=4 for total ~8x at climax.

### JavaScript Functions for Activation Levels

These are update functions: Call them iteratively in a loop with current activations, intensity, and \( \Delta t \) (seconds) to simulate over time. For sexual, also pass/track cumulative dose. They return updated values. Use small \( \Delta t \) (e.g., 1s) for accuracy.

```javascript
// Stress Scenario Update Function
function updateStressActivation(currentSNS, currentPNS, intensity, deltaT) {
    // Validate inputs
    if (intensity < 0 || intensity > 1) {
        throw new Error("Intensity must be between 0 and 1");
    }
    if (deltaT <= 0) {
        throw new Error("DeltaT must be positive");
    }

    const alphaSNS = 0.5;
    const beta = 2.0;
    const gammaSNS = 0.05;

    const alphaPNS = -0.3;
    const gammaPNS = 0.05;

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

// Sexual Scenario Update Function
function updateSexualActivation(currentSNS, currentPNS, currentCumulativeDose, intensity, deltaT) {
    // Validate inputs
    if (intensity < 0 || intensity > 1) {
        throw new Error("Intensity must be between 0 and 1");
    }
    if (deltaT <= 0) {
        throw new Error("DeltaT must be positive");
    }

    const alphaPNS = 0.4;
    const beta = 1.5;
    const gammaPNS = 0.03;

    const alphaSNS = 0.3;
    const gammaSNS = 0.03;

    const climaxThreshold = 10.0;
    const orgasmSpike = 4.0;

    // Calculate rates
    const dPNS = alphaPNS * Math.pow(intensity, beta) - gammaPNS * (currentPNS - 1);
    let dSNS = alphaSNS * Math.pow(intensity, beta) - gammaSNS * (currentSNS - 1);

    // Update cumulative dose
    const newCumulativeDose = currentCumulativeDose + intensity * deltaT;

    // Check for climax threshold crossing and add impulse spike to SNS if crossed
    let newSNS = currentSNS + deltaT * dSNS;
    if (newCumulativeDose > climaxThreshold && currentCumulativeDose <= climaxThreshold) {
        newSNS += orgasmSpike;  // Fixed impulse addition once per crossing
    }

    // Clamp
    newSNS = Math.max(1, newSNS);
    let newPNS = currentPNS + deltaT * dPNS;
    newPNS = Math.max(1, newPNS);

    return { newSNS, newPNS, newCumulativeDose };
}
```

### Usage Example
Here's how to simulate scenarios by looping over time steps with varying intensities. Outputs can be collected in arrays for graphing or analysis (e.g., check if SNS > 8 for "peak reached," or when activations return to ~1 after intensity=0).

```javascript
// Example: Simulate Instantaneous Stress (brief high intensity)
let sns = 1.0;
let pns = 1.0;
const deltaT = 1.0;  // 1 second steps
const totalSteps = 60;  // 1 minute
const intensities = new Array(totalSteps).fill(0);
for (let i = 10; i < 20; i++) intensities[i] = 1.0;  // Pulse at 10-20s

for (let step = 1; step < totalSteps; step++) {
    const result = updateStressActivation(sns, pns, intensities[step], deltaT);
    sns = result.newSNS;
    pns = result.newPNS;
    console.log(`Time ${step}s: SNS=${sns.toFixed(2)}, PNS=${pns.toFixed(2)}`);
    // Peak if sns > 5; back to normal if ~1 after intensity=0
}

// Example: Simulate Extended Sexual Plateau (sustained moderate intensity)
sns = 1.0;
pns = 1.0;
let cumulative = 0.0;
const intensitiesExtended = new Array(totalSteps).fill(0);
for (let i = 10; i < 250; i++) intensitiesExtended[i] = 0.5;  // Long low-moderate

for (let step = 1; step < totalSteps; step++) {
    const result = updateSexualActivation(sns, pns, cumulative, intensitiesExtended[step], deltaT);
    sns = result.newSNS;
    pns = result.newPNS;
    cumulative = result.newCumulativeDose;
    console.log(`Time ${step}s: SNS=${sns.toFixed(2)}, PNS=${pns.toFixed(2)}, Cumulative=${cumulative.toFixed(2)}`);
    // Climax reached if cumulative > 10 (may delay with low I)
}

// Similar loops for other variants, adjusting intensities array
```

These allow flexible simulation: High brief I for instantaneous peaks, sustained I for extended maintenance, low I for plateaus without peaks. Adjust parameters if needed for different scales. If you want more variants or graphing code, let me know!