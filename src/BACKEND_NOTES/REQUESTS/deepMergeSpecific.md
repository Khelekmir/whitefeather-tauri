Thanks for the context — that clears things up.

Right now your service method does a *shallow merge*:

```java
currentStats.putAll(updates);
```

That works for flat keys, but won’t merge nested structures like `itemizedHealth`. To **apply minimal nested updates** like:

```json
{
  "itemizedHealth": {
    "leftLeg": 0.82
  }
}
```

—you’ll need to *deep merge* nested maps instead.

---

## ✅ Updated `patchCombatStats` with Nested Merge Support

Here’s how you can update the `patchCombatStats` method to merge nested maps (like `itemizedHealth`) without overwriting the whole sub-map:

```java
@Transactional
public void patchCombatStats(int playerCharacterId, Map<String, Object> updates) {
    PlayerCharacter pc = playerCharacterRepository.findById(playerCharacterId)
            .orElseThrow(() -> new ResourceNotFoundException("PlayerCharacter not found"));

    Map<String, Object> currentStats = pc.getCombatStats();

    for (Map.Entry<String, Object> entry : updates.entrySet()) {
        String key = entry.getKey();
        Object value = entry.getValue();

        if (value instanceof Map && currentStats.get(key) instanceof Map) {
            // Perform deep merge on nested map (e.g., itemizedHealth)
            Map<String, Object> currentSubMap = (Map<String, Object>) currentStats.get(key);
            Map<String, Object> patchSubMap = (Map<String, Object>) value;

            for (Map.Entry<String, Object> subEntry : patchSubMap.entrySet()) {
                currentSubMap.put(subEntry.getKey(), subEntry.getValue());
            }

        } else {
            // Overwrite flat value
            currentStats.put(key, value);
        }
    }

    pc.setCombatStats(currentStats);
    playerCharacterRepository.save(pc);
}
```

---

## 🧪 Example Input

If the current stored value is:

```json
{
  "itemizedHealth": {
    "head": 1.0,
    "leftLeg": 0.9
  }
}
```

And your PATCH body is:

```json
{
  "itemizedHealth": {
    "leftLeg": 0.82
  }
}
```

Then after this update, the new map will be:

```json
{
  "itemizedHealth": {
    "head": 1.0,
    "leftLeg": 0.82
  }
}
```

---

## 🧼 Optional: Extract Deep Merge to Utility

If you expect more nesting or want cleaner code, you can extract the deep-merge logic into a reusable method. But for now, this logic in-place is perfectly reasonable.

Want help testing this with a sample JSON request?
