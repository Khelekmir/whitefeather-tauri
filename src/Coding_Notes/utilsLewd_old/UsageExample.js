import updateStressActivation from "./StressActivation.js";
import updateSexualActivation from "./SexualActivation.js";

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