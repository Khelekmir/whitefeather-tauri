export function calcStaminaPenalty(staminaCap, staminaCurrent) {
    return Math.sqrt(staminaCurrent / staminaCap);
};