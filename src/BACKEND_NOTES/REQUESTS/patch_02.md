Haha classic — glad it was a simple URL oversight! That’s one of those “duh” moments we all hit 😅

---

### 🔧 Now, about PATCH...

#### ✅ Short Answer:
Nope — you **can’t** reuse your `@PutMapping` method as-is to handle `PATCH` requests.

Spring requires you to explicitly declare:

```java
@PatchMapping("/{playerCharacterId}/combatStats")
```

Or, more generically:

```java
@RequestMapping(value = "/{playerCharacterId}/combatStats", method = RequestMethod.PATCH)
```

PUT and PATCH are **different HTTP verbs**, so Spring won’t route a PATCH to your `@PutMapping`, even if the path is the same.

---

### 🔍 The Real Difference: Semantics & Payloads

| Verb | Meaning | Expectation |
|------|---------|-------------|
| `PUT` | Full replacement | You send the **entire updated object**. |
| `PATCH` | Partial update | You send **only the fields** you want to change. |

So you’ll want a different method to handle PATCH — usually with **more conditional logic** inside.

---

### ✅ Example Using PATCH with Same Repo Method

Here’s how you could handle PATCH **without writing extra repo methods**, assuming you're just patching a JSON field like `combatStats`.

#### Controller:
```java
@PatchMapping("/{playerCharacterId}/combatStats")
public ResponseEntity<Void> patchCombatStats(
        @PathVariable int playerCharacterId,
        @RequestBody Map<String, Object> updates) {
    logger.info("Patching combatStats for PlayerCharacter with id: {}", playerCharacterId);
    playerCharacterService.patchCombatStats(playerCharacterId, updates);
    return ResponseEntity.noContent().build();
}
```

#### Service:
```java
@Transactional
public void patchCombatStats(int playerCharacterId, Map<String, Object> updates) {
    PlayerCharacter pc = playerCharacterRepository.findById(playerCharacterId)
        .orElseThrow(() -> new ResourceNotFoundException("PlayerCharacter not found"));

    // Merge updates into existing stats
    Map<String, Object> currentStats = pc.getCombatStats();
    currentStats.putAll(updates); // this overwrites only the updated fields

    pc.setCombatStats(currentStats);
    playerCharacterRepository.save(pc); // triggers UPDATE
}
```

No need for a special SQL query — just load the entity, mutate the map, and re-save. This works great for JSONB fields!

---

### ✅ TL;DR

- **You need a separate method** in the controller for `PATCH`
- You **can reuse your repository** logic or even skip it if you use `.save()`
- PATCH is perfect for updating part of a field (like tweaking one stat)

---

Let me know if you'd like to PATCH other types of fields — strings, booleans, nested objects — and I can show examples for those too.