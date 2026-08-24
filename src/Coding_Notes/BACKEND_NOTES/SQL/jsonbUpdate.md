To **update a deeply nested key** (like `combatStats.base.luck`) in a `jsonb` column (`combat_stats`) in PostgreSQL, you can use the `jsonb_set` function.

Here’s an example of how to change `"luck"` from `30` to `29` inside the nested path `combatStats -> base -> luck`:

```sql
UPDATE player_character
SET combat_stats = jsonb_set(
    combat_stats,
    '{combatStats,base,luck}',
    '29',
    false
)
WHERE name = 'Amberyl';
```

### Explanation:

* `jsonb_set(target jsonb, path text[], new_value jsonb, create_missing boolean)`

  * `combat_stats` is the target column.
  * `'{combatStats,base,luck}'` is the path to the nested key.
  * `'29'` is the new value (must be valid JSON — in this case, a raw number).
  * `false` tells PostgreSQL *not* to create missing keys if any part of the path doesn’t exist.

### ⚠️ Important:

Ensure:

* The `combat_stats` column already has a value and structure matching the provided JSON (i.e., it already includes `"combatStats": {"base": {"luck": 30, ...}}`).
* The keys use camelCase (`combatStats`) and not snake\_case (`combat_stats`) inside the JSON.

///

Great — to **conditionally create the path if it’s missing**, just set the final argument in `jsonb_set` to `true`.

Here’s the syntax with that flag enabled:

```sql
UPDATE player_character
SET combat_stats = jsonb_set(
    combat_stats,
    '{combatStats,base,luck}',
    '29',
    true
)
WHERE name = 'Amberyl';
```

### Breakdown:

* `true` tells PostgreSQL to **create the missing keys** along the path (`combatStats`, `base`, or `luck`) if they don’t already exist.
* This is useful if you're not sure whether the full structure exists yet — for example, if some characters haven't had their stats initialized.

### Gotcha:

If `combat_stats` is just `{}` or missing the entire `combatStats` block, this will insert only the path you're updating, like:

```json
{
  "combatStats": {
    "base": {
      "luck": 29
    }
  }
}
```

It won’t populate the rest (e.g., `magic`, `skill`, etc.) — so make sure that's okay in your use case.
