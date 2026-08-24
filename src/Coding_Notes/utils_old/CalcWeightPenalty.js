export function calcWeightPenalty(constitution, weight, offhand = 0) {
    const logNumber = 12;
    const result = Math.min(1, Math.log(logNumber - (weight + offhand - constitution)) / Math.log(logNumber));
    return result;
}
