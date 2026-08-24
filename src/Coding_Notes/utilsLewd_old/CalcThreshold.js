import { roundToThousandths } from "../utils/CombatConfig";
import { lewdBits } from "./LewdConfig";
import { lewdActionList } from "./LewdConfig";

export function calcThreshold(
    partUsedIntimacy,
    actionIntimacy,
    partReceivingIntimacy,
    intensity = 1.0,
    clothed = false
) {
    const A = partUsedIntimacy.intimacy;     // 0.4 → 9.8
    const B = actionIntimacy.intimacy;       // 2.2 → 8.9
    const C = partReceivingIntimacy.intimacy;// 0.4 → 9.8

    // Core idea: action is king, parts are secondary, intensity scales slowly
    const raw =
        B * 4.8                                      // action dominates
        + (A + C) * 0.9                               // parts still matter ~35 % total
        + 3.8 * Math.log1p(intensity);               // intensity bonus, caps ~+15 at insane levels

    // Optional clothed penalty (you said not implemented yet)
    const clothedPenalty = clothed ? 8.0 : 0;

    return roundToThousandths(raw - clothedPenalty);
}