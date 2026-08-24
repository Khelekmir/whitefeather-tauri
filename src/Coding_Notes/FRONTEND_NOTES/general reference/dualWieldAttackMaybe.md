To support dual-wielding and preserve your existing single-attack functionality, you can modify your function to **run `resolveAttack()` twice** when both hands are wielding weapons, then **merge the results** before issuing the patch.

### Key goals:

* Call `resolveAttack()` twice with the same inputs.
* Collect both `bodypartHit` values.
* Combine the `updatedCombatStats` results into a single delta.
* Send a **single patch**.
* Update all state appropriately.

---

### ✅ Suggested Approach (Full Replacement of Your Function):

```js
const handleAttackTargetSelectionClick = (target) => {
    setAttackTarget(target);

    const isDualWielding = (
        attacker.mainhand.itemType === "weapon" &&
        attacker.offhand.itemType === "weapon"
    );

    const attacksToRun = isDualWielding ? 2 : 1;
    let combinedCombatStats = defender.combatStats;
    const hitTargets = [];
    let totalDamage = 0;
    let anyHit = false;

    for (let i = 0; i < attacksToRun; i++) {
        const result = resolveAttack({
            attackTarget: target,
            attackTargets,
            attackerAttackTotals,
            attackerAttackValue: attackerAttackTotals.attackValueMainhand,
            defender,
            defenderDefenseTotals,
            equipmentKeys,
        });

        hitTargets.push(result.bodypartHit);
        totalDamage += result.damage;
        if (result.result !== "miss") {
            anyHit = true;
            combinedCombatStats = result.updatedCombatStats;
        }
    }

    // Store multiple hit targets or just one
    setHitTarget(isDualWielding ? hitTargets : hitTargets[0]);
    setDamageDone(totalDamage);
    setHasAttacked(true);

    if (!anyHit) return;

    const patch = buildMinimalPatch(defender.combatStats, combinedCombatStats);
    const id = defender.id;

    if (Object.keys(patch).length > 0) {
        request.patch(urls.characterCombatStats(id), patch, () => {
            console.log("patch: ", patch);
            console.log("Hit Button Pressed");
        });
    }

    setDefender(prev => ({
        ...prev,
        combatStats: combinedCombatStats
    }));
};
```

---

### 🔍 Key Points:

* This runs `resolveAttack()` twice if dual-wielding, but only once otherwise.
* It stores **both `bodypartHit` results** in an array (`hitTargets`) if dual-wielding, otherwise just one.
* It **accumulates `damage`** and sets it with `setDamageDone(totalDamage)`.
* It **combines updated combat stats** using the most recent one (or you can merge these more deeply if needed).
* It sends only one patch.

---

Let me know if your `resolveAttack` returns cumulative stats already (e.g. stacking effects from multiple hits). If so, we may want to do a deeper merge of `result.updatedCombatStats` instead of replacing them.
