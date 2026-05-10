Perfect — you’ve laid out everything clearly, and you're right on track for implementing armor durability loss in a nuanced way. Here’s how you could architect this in steps:

---

### 🔧 1. **Determine What’s Hit and What’s Protecting It**

Each time an attack hits a body part (`bodypartHit`), use `bodypartArmorAssignments` to get all `itemSlot`s that could protect that part.

```js
const armorSlots = bodypartArmorAssignments[bodypartHit] || [];
```

---

### 🧩 2. **Filter Defender’s Equipped Armor Items**

From `defender`, collect all items that match the slots and are of `itemType: "armor"`.

```js
const protectingArmor = armorSlots
    .map(slot => defender[slot])
    .filter(item => item && item.itemType === "armor");
```

---

### 📉 3. **Calculate Durability Loss**

This is where your linear scaling comes in. Start with a simple formula:

```js
function calcArmorDurabilityLoss(armorItem, damage) {
    const material = equipmentMaterial[armorItem.combatStats.itemType] || equipmentMaterial["cloth"];
    const sizeMultiplier = armorSizeMultipliers[armorItem.itemSlot] || 1;

    // Basic formula: damage absorbed scaled by inverse of durability and size
    const durabilityLoss = (damage * sizeMultiplier) / (material.durability * 100); // 100 is just a tuning constant
    return Math.min(armorItem.combatStats.durability, durabilityLoss);
}
```

---

### 🧾 4. **Update Durability in `resolveAttack`**

Update the armor’s `combatStats.durability` and store the new values in a return field like `updatedEquipment`, alongside `updatedCombatStats`.

```js
const updatedEquipment = {};

protectingArmor.forEach(item => {
    const loss = calcArmorDurabilityLoss(item, damage);
    const newDurability = Math.max(0, item.combatStats.durability - loss);

    updatedEquipment[item.itemSlot] = {
        ...item,
        combatStats: {
            ...item.combatStats,
            durability: newDurability
        }
    };
});
```

---

### 📦 5. **Return the Equipment Changes**

Include the durability updates in your `resolveAttack` return object:

```js
return {
    result: "hit",
    bodypartHit,
    damage,
    updatedCombatStats,
    updatedEquipment // <- new
};
```

---

### 🔁 6. **In Your Patch Application Logic**

You now need to extend your patch logic to include updates from `updatedEquipment` and apply those changes to the backend and local state.

---

This gives you a clean flow:

* One hit → one body part → possibly many armor pieces → each takes damage depending on material + size.
* Patch updates now include health and gear degradation.

If you want, I can help integrate this logic into your existing `resolveAttack` function or walk through building a unit test for it.
