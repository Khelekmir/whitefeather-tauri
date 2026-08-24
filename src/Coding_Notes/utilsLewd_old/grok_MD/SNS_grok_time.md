### Description of PNS and SNS Activation Models

Based on established patterns from neurophysiological literature, I've modeled the parasympathetic nervous system (PNS) and sympathetic nervous system (SNS) activation levels for both sexual arousal and fight-or-flight stress scenarios. These are loose approximations, not based on precise medical data, but derived from qualitative descriptions of autonomic responses. PNS is associated with relaxation, vasodilation, and initial sexual arousal (e.g., erection/lubrication), while SNS drives arousal intensification, contractions (e.g., during orgasm or stress mobilization), and can inhibit if excessive. Levels are normalized such that 1 represents at-rest baseline (balanced autonomic tone).

- **Stress (Fight-or-Flight) Scenario**: This models a typical acute stressor encounter, such as perceiving a threat. SNS activates rapidly for energy mobilization (e.g., increased heart rate, blood flow to muscles), peaking early and sustaining during the "active" phase before declining as the threat resolves. PNS is suppressed during the peak to prioritize action, dropping below baseline and recovering afterward. The time course assumes a quick onset, sustained response, and resolution.
- **Sexual Arousal Scenario**: This models a complete sexual encounter (e.g., from desire to resolution). PNS dominates early arousal for genital engorgement and relaxation, peaking mid-encounter but declining at climax. SNS provides moderate facilitation during arousal/plateau (enhancing focus and blood flow in a curvilinear manner—optimal at moderate levels) and peaks sharply at orgasm for contractions/ejaculation, then resolves. Excessive SNS early could inhibit, but the model assumes an optimal progression.

Time \( t \) is normalized from 0 (start of encounter) to 1 (end/resolution). Models use Gaussian functions for smooth peaks/dips, with parameters tuned to reflect described patterns (e.g., rapid SNS rise in stress, moderate SNS in sexual plateau). Peaks are set to plausible multiples (e.g., SNS up to 8-10x in stress, 4-6x in sexual orgasm; PNS up to 4-5x in sexual arousal, down to 0.2-0.5 in stress).

### Mathematical Formulas for Activation Levels

#### Stress (Fight-or-Flight) Scenario
- **SNS Ratio Formula**: Rapid rise to peak early (around \( t = 0.3 \), simulating quick activation), sustained somewhat, then decline. Uses a broad Gaussian for the overall surge.
\[
SNS_s(t) = 1 + 9 \exp\left( -\frac{(t - 0.3)^2}{2 \times 0.2^2} \right).
\]
**How to arrive at this formula:** Based on descriptions of immediate SNS discharge upon threat perception, amplifying energy for action and sustaining during response. Center at 0.3 for early peak; amplitude 9 for ~10x max (reflecting catecholamine surge); width 0.2 for quick rise/sustained plateau before full resolution. Evaluated to near 1 at ends.

- **PNS Ratio Formula**: Sharp suppression during SNS peak, recovering later. Inverted Gaussian to model dip.
\[
PNS_s(t) = 1 - 0.8 \exp\left( -\frac{(t - 0.3)^2}{2 \times 0.2^2} \right).
\]
**How to arrive at this formula:** PNS decreases during SNS dominance to avoid counteracting fight-or-flight, reactivating post-response for homeostasis. Amplitude -0.8 for min ~0.2 (strong suppression); same center/width as SNS for opposition.

#### Sexual Arousal Scenario
- **SNS Ratio Formula**: Moderate rise mid-encounter (plateau), sharp peak at orgasm (\( t = 0.75 \)), then drop. Dual Gaussians: broad for facilitation, narrow for climax.
\[
SNS_x(t) = 1 + 3 \exp\left( -\frac{(t - 0.5)^2}{2 \times 0.25^2} \right) + 4 \exp\left( -\frac{(t - 0.75)^2}{2 \times 0.05^2} \right).
\]
**How to arrive at this formula:** Moderate SNS facilitates arousal (curvilinear optimum), but peaks at orgasm for contractions/ejaculation. First term: amplitude 3, center 0.5, width 0.25 for ~4x mid-plateau. Second: amplitude 4, center 0.75, width 0.05 for sharp ~5x orgasm spike (total ~8x max). Near 1 at ends.

- **PNS Ratio Formula**: Rise early for arousal (\( t = 0.4 \)), plateau, slight dip at orgasm. Broad Gaussian with asymmetric width (wider post-peak for gradual resolution).
\[
PNS_x(t) = 1 + 4 \exp\left( -\frac{(t - 0.4)^2}{2 \sigma^2} \right)
\]
where
\[
\sigma = 
\begin{cases} 
0.2 & \text{if } t \leq 0.4 \\
0.3 & \text{if } t > 0.4 
\end{cases}.
\]
**How to arrive at this formula:** PNS predominates in arousal for vasodilation/engorgement, less at orgasm where SNS takes over. Amplitude 4 for ~5x peak; center 0.4 for early rise; piecewise \(\sigma\) for quicker rise, slower decline (mimicking sustained arousal then resolution).

### JavaScript Functions for Activation Levels

These functions take a normalized time \( t \) (0 to 1) and return the activation ratio, with validation.

```javascript
function snsStressRatio(t) {
    // Validate input: t must be between 0 and 1
    if (t < 0 || t > 1) {
        throw new Error("Time t must be between 0 and 1");
    }

    // Calculate Gaussian term
    const term = 9 * Math.exp(-Math.pow(t - 0.3, 2) / (2 * Math.pow(0.2, 2)));

    // Return SNS ratio
    return 1 + term;
}

function pnsStressRatio(t) {
    // Validate input: t must be between 0 and 1
    if (t < 0 || t > 1) {
        throw new Error("Time t must be between 0 and 1");
    }

    // Calculate inverted Gaussian term
    const term = 0.8 * Math.exp(-Math.pow(t - 0.3, 2) / (2 * Math.pow(0.2, 2)));

    // Return PNS ratio
    return 1 - term;
}

function snsSexualRatio(t) {
    // Validate input: t must be between 0 and 1
    if (t < 0 || t > 1) {
        throw new Error("Time t must be between 0 and 1");
    }

    // Calculate two Gaussian terms
    const term1 = 3 * Math.exp(-Math.pow(t - 0.5, 2) / (2 * Math.pow(0.25, 2)));
    const term2 = 4 * Math.exp(-Math.pow(t - 0.75, 2) / (2 * Math.pow(0.05, 2)));

    // Return SNS ratio
    return 1 + term1 + term2;
}

function pnsSexualRatio(t) {
    // Validate input: t must be between 0 and 1
    if (t < 0 || t > 1) {
        throw new Error("Time t must be between 0 and 1");
    }

    // Define sigma based on t
    const sigma = t <= 0.4 ? 0.2 : 0.3;

    // Calculate Gaussian term
    const term = 4 * Math.exp(-Math.pow(t - 0.4, 2) / (2 * Math.pow(sigma, 2)));

    // Return PNS ratio
    return 1 + term;
}
```

### Usage Example
```javascript
console.log(snsStressRatio(0.3)); // Approx 10 (peak during stress)
console.log(pnsStressRatio(0.3)); // Approx 0.2 (suppressed during stress)
console.log(snsSexualRatio(0.75)); // Approx 8 (peak at orgasm)
console.log(pnsSexualRatio(0.4)); // Approx 5 (peak during arousal)
console.log(snsStressRatio(0)); // Approx 1 (baseline)
```

These can be graphed using libraries like Chart.js by evaluating at multiple \( t \) points. If you need adjustments, visualizations, or integration with prior hormone models, let me know!