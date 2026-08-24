import { incrementHappiness, incrementStress } from "./IncrementSocial";

export function incrementHappinessAndStress(
    curH, curS,
    baseH, baseS,
    hGrow, hDecay,
    sGrow, sDecay,
    deltaT
) {
    return {
        newHappiness: incrementHappiness(curH, baseH, hGrow, hDecay, deltaT),
        newStress: incrementStress(curS, baseS, sGrow, sDecay, deltaT)
    };
} // TODO: get away from this