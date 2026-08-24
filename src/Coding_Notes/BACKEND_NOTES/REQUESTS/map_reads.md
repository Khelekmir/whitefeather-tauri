Yes — you’ve nailed the structural idea of using `Map<String, Object>` with `@Type(JsonType.class)` and PostgreSQL’s `jsonb`. The only *gotcha* you’ve run into is the use of immutable maps like `Map.ofEntries(...)`, which can’t be mutated (e.g., no `.put()`, `.putAll()`, or `.remove()` — it’ll throw `UnsupportedOperationException`).

---

## ✅ How to Fix It

Here’s how to change your `tradeSkills` field to use a **mutable** map while keeping the same structure:

### 🔧 Corrected Field

```java
@Type(JsonType.class)
@Column(columnDefinition = "jsonb", nullable = false)
private Map<String, Object> tradeSkills = new LinkedHashMap<>(Map.ofEntries(
        Map.entry("generalSurvival", 0),
        Map.entry("fishing", 0),
        Map.entry("skinning", 0),
        Map.entry("herbalism", 0),
        Map.entry("carving", 0),
        Map.entry("laundry", 0),
        Map.entry("horseTending", 0),
        Map.entry("pegasusTending", 0),
        Map.entry("sharpeningWeapons", 0),
        Map.entry("rustPrevention", 0),
        Map.entry("buildingFire", 0),
        Map.entry("cooking", 0),
        Map.entry("recipes", List.of(
                "grilledFish",
                "roastedMeat",
                "boiledVegetables",
                "herbalTea",
                "spicySoup")),
        Map.entry("barter", 0),
        Map.entry("stealing", 0),
        Map.entry("spying", 0),
        Map.entry("lying", 0)
));
```

### ✅ Why This Works:
- `new LinkedHashMap<>(...)` wraps the `Map.ofEntries(...)` in a mutable map implementation.
- You keep your clean and readable builder-style initialization.
- Now you **can update** this field after the object is created.

---

## 🧪 Now You Can Do:
- `tradeSkills.put("newSkill", 1);`
- `tradeSkills.put("fishing", 3);`
- `tradeSkills.remove("lying");`
- Or merge via `.putAll(...)` from a PATCH request

---

## 💡 Bonus: Use `@PostLoad` or Constructors to Ensure Mutability

If you sometimes load data from the DB and it's accidentally treated as immutable (very rare with Hibernate but possible with deserialization from JSON), you can ensure safety by converting it to mutable post-load:

```java
@PostLoad
private void ensureMutableMaps() {
    if (!(tradeSkills instanceof LinkedHashMap)) {
        tradeSkills = new LinkedHashMap<>(tradeSkills);
    }
}
```

---

Let me know if you'd like to extract your default map into a `static` method for reuse — that keeps constructors cleaner.