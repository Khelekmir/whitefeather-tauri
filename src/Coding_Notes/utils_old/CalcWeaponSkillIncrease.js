// let attackerSkillIncrease = calcWeaponSkillIncrease("attacker", attacker, mainhandHitResult, offhandResult.hitResult || "none");

export function calcWeaponSkillIncrease(role, hitResult, attackBlocked) {

    if (role === "attacker") {
        switch (hitResult) {
            case "attackHit":
                return attackBlocked ? 0.5 : 1;
            case "attackParry":
                return 0.3;
            case "attackDodge":
                return 0.2;
            case "attackAvoid":
                return 0.1;
            case "attackMiss":
                return 0;
            case "attackCrit":
                return attackBlocked ? 1.5 : 2;
        }
    } else if (role === "defender") {
        if (hitResult === "attackParry") { 
            return 1 
        } else { 
            return 0 
        };
    }
}