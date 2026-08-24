Your logic is solid and your code is functionally clear, but it can definitely be improved in **readability, modularity, and DRYness**. Below are **clean-up improvements** and the **revised code**, followed by a rationale.

---

### ✅ Key Improvements

1. **Simplified `calcItemWeight` logic**:

   * Consolidated repeated code for shields and weapons using a lookup map.
2. **Renamed `extractWeaponStats` → `getWeaponStats`** for clarity.
3. **Grouped variables** in `calcAttackTotals` to reduce repetition and improve readability.
4. **Used early returns** where applicable.
5. **Grouped equipment bonus logic** together.
6. **Removed unused imports and commented code**.
7. **De-nested where possible**.

---

### 🔁 `CalcItemWeight.js` (refactored)

```js
import { equipmentMaterial, shieldTypes, weaponTypes } from "./CombatConfig";

export function calcItemWeight(item) {
    if (!item || item.itemType === "unequipped") return 0;

    const material = equipmentMaterial[item.combatStats.material];

    const typeMap = {
        shield: shieldTypes,
        weapon: weaponTypes
    };

    const typeInfo = typeMap[item.itemType]?.[item.combatStats[`${item.itemType}Type`]];
    if (!typeInfo || !material) return 0;

    return typeInfo.sizeFactor * material.weight;
}
```

---

### 🔁 `AttackTotals.js` (refactored)

```js
import { calcHealthPenalty } from './CalcHealthPenalty';
import { calcStaminaPenalty } from './CalcStaminaPenalty';
import { calcWeightPenalty } from './CalcWeightPenalty';
import { weaponTypes, equipmentMaterial, equipmentKeys } from './CombatConfig';
import { calcItemWeight } from './CalcItemWeight';

export function calcAttackTotals(character) {
    const { combatStats, mainhand, offhand } = character;
    const { base: baseStats, itemizedHealth } = combatStats;

    const noOffhand = offhand.itemType === "unequipped";
    const offhandIsShield = offhand.itemType === "shield";

    const mainhandWeight = calcItemWeight(mainhand);
    const offhandWeight = calcItemWeight(offhand);
    const combinedWeight = mainhandWeight + offhandWeight;

    const mainStats = getWeaponStats(mainhand, combatStats, true, noOffhand);
    const offStats = getWeaponStats(offhand, combatStats);

    const baseHitChance = getHitChance(baseStats, mainStats?.weight || 0, mainStats?.weaponSkill || 1, itemizedHealth, offhandIsShield, combinedWeight);
    const baseCritChance = getCritChance(baseStats, mainStats?.weaponSkill || 1);

    const baseAttackValueMainhand = mainStats
        ? getAttackValue(baseStats, mainStats, itemizedHealth, offhandIsShield, combinedWeight)
        : 0;

    const baseAttackValueOffhand = offStats
        ? getAttackValue(baseStats, offStats, itemizedHealth, offhandIsShield, combinedWeight) * 0.7
        : 0;

    const baseCritValue = 1;

    const totals = {
        hitChance: baseHitChance,
        critChance: baseCritChance,
        attackValueMainhand: baseAttackValueMainhand,
        attackValueOffhand: baseAttackValueOffhand,
        critValue: baseCritValue
    };

    equipmentKeys.forEach(slot => {
        const chance = character[slot]?.combatStats?.bonus?.chance || {};
        const value = character[slot]?.combatStats?.bonus?.value || {};

        totals.hitChance += chance.hit || 0;
        totals.critChance += chance.critical || 0;
        totals.critValue += value.critical || 0;
        totals.attackValueMainhand *= 1 + (value.damage || 0);
        totals.attackValueOffhand *= 1 + (value.damage || 0);
    });

    return {
        base: { baseHitChance, baseAttackValueMainhand, baseAttackValueOffhand, baseCritChance, baseCritValue },
        total: totals,
        damageType: mainStats?.damageType,
        damageTypeOffhand: offStats?.damageType
    };
}

// --- Helpers ---

function getWeaponStats(item, characterStats, allowTwoHanding = false, noOffhand = false) {
    if (!item || item.itemType !== "weapon") return null;

    const { weaponType, material, durability } = item.combatStats;
    const weaponSkill = characterStats.weaponSkill[weaponType] || characterStats.weaponSkill.unequipped;

    const { sizeFactor, powerMultiplier, twoHanded, damageType } = weaponTypes[weaponType];
    const materialInfo = equipmentMaterial[material];

    const weight = sizeFactor * materialInfo.weight;
    const strength = materialInfo.strength;

    let twoHandingSpecial = false;
    let twoHandingNormal = false;

    if (allowTwoHanding) {
        twoHandingSpecial = item.misc?.twoHandOptional && noOffhand;
        twoHandingNormal = !twoHanded && noOffhand;
    }

    return {
        weaponType,
        weaponSkill,
        damageType,
        weight,
        strength,
        durability,
        powerMultiplier,
        twoHandingSpecial,
        twoHandingNormal
    };
}

function getHitChance(stats, weight, skill, itemizedHealth, offhandIsShield, combinedWeight) {
    const base = (Math.log(skill) / Math.log(1000)) + (stats.skill / 50);
    const weightPenalty = calcWeightPenalty(stats.constitution, offhandIsShield ? combinedWeight : weight);
    const staminaPenalty = calcStaminaPenalty(stats.staminaCap, stats.staminaCurrent);
    const healthPenalty = calcHealthPenalty(itemizedHealth, "weaponHitChance");

    return base * weightPenalty * staminaPenalty * healthPenalty;
}

function getCritChance(stats, skill) {
    const base = (Math.sqrt(stats.skill * stats.agility) / 2) * (Math.log10(skill)) / 100;
    const staminaPenalty = calcStaminaPenalty(stats.staminaCap, stats.staminaCurrent);
    const luckBonus = Math.sqrt(stats.luck) / 100;
    return base * staminaPenalty + luckBonus;
}

function getAttackValue(stats, weaponStats, itemizedHealth, offhandIsShield, combinedWeight) {
    const {
        weight,
        strength,
        powerMultiplier,
        durability,
        twoHandingSpecial,
        twoHandingNormal
    } = weaponStats;

    const physicalConstant = 1;
    let twoHandedMultiplier = twoHandingSpecial ? 1.5 : twoHandingNormal ? 1.25 : 1;

    const base = (
        (Math.log10(stats.strength) * Math.max(0, Math.log10(weight))) +
        Math.log10(stats.strength) ** 2
    ) * physicalConstant * twoHandedMultiplier;

    const adjusted = weight > stats.strength
        ? base * (stats.strength / weight)
        : base;

    const weightPenalty = calcWeightPenalty(stats.constitution, offhandIsShield ? combinedWeight : weight);
    const healthPenalty = calcHealthPenalty(itemizedHealth, "weaponAttackPower");
    const staminaPenalty = calcStaminaPenalty(stats.staminaCap, stats.staminaCurrent);

    return adjusted * weightPenalty * healthPenalty * staminaPenalty * strength * powerMultiplier * Math.sqrt(durability);
}
```

---

### 📌 Summary of Benefits

* **`calcItemWeight`** now avoids duplicated logic.
* **`calcAttackTotals`** is more readable with consistent patterns and grouped logic.
* **Helper functions** are more clearly defined and easier to unit test.
* You’ve set yourself up for **easier debugging and maintenance** down the road.

Let me know if you'd like these modules split or typed for TypeScript.
