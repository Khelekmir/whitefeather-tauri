import { buildMinimalPatch } from "../utils/ObjectPatchUtils";
import { roundToThousandths } from "../utils/CombatConfig";
import { lewdBits } from "../utilsLewd/LewdConfig";
import { lewdActionList } from "../utilsLewd/LewdConfig";
import { gearLewdStatsDict } from "../utilsLewd/LewdConfig";
import { calcHormones } from "./CalcHormones";

export function resolveLewd({
    topChar,
    bottomChar,
    topPart,
    action,
    intensity,
    bottomPart,
    relTopToBottom,
    relBottomToTop
}) {
}