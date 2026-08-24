Almost — but **not quite**. The syntax you wrote:

```sql
AND (misc -> 'allegiance' = 'friend')
```

is **invalid** because:

- `misc -> 'allegiance'` returns a **JSON/JSONB value** (e.g., the string `"friend"` as a `jsonb` object),
- You **cannot directly compare** a `jsonb` value to a text string using `=`.

---

### Correct Syntax

You need to use **`->>`** to extract the value **as text**, then compare:

```sql
AND (misc ->> 'allegiance') = 'friend'
```

or for the enemy case:

```sql
AND (misc ->> 'allegiance') = 'enemy'
```

---

### Full Working Examples

#### 1. Filter for **friends**:
```sql
SELECT *
FROM player_character
WHERE sex = 'F'
  AND (social_stats -> 'static' ->> 'baselineStress')::int >= 50
  AND (misc ->> 'allegiance') = 'friend';
```

#### 2. Filter for **enemies**:
```sql
SELECT *
FROM player_character
WHERE (misc ->> 'allegiance') = 'enemy';
```

#### 3. Filter for **either friend or enemy** (exclude null/missing):
```sql
SELECT *
FROM player_character
WHERE (misc ->> 'allegiance') IN ('friend', 'enemy');
```

---

### Safer Version (handles missing keys)

If some rows might **not have** the `allegiance` key (or `misc` is `NULL`), use:

```sql
AND misc ? 'allegiance'                    -- key exists
AND (misc ->> 'allegiance') = 'friend'
```

Or combine both:

```sql
AND (misc ->> 'allegiance') IS NOT NULL
AND (misc ->> 'allegiance') = 'friend'
```

---

### Summary: `->` vs `->>`

| Operator | Returns | Use for |
|--------|--------|--------|
| `->`   | `jsonb` | When you want to dig deeper into nested objects |
| `->>`  | `text`  | When you want the **final value to compare** |

So:
```sql
misc -> 'allegiance'        -- returns: "friend" (as jsonb)
misc ->> 'allegiance'       -- returns: 'friend' (as text) ← use this!
```

---

### Final Recommended Query (robust)

```sql
SELECT *
FROM player_character
WHERE sex = 'F'
  AND (social_stats -> 'static' ->> 'baselineStress')::int >= 50
  AND misc ? 'allegiance'
  AND (misc ->> 'allegiance') = 'friend';
```

This ensures:
- Only females
- `baselineStress >= 50`
- `misc` has an `allegiance` key
- That allegiance is `"friend"`

Let me know if you want to search **case-insensitively** or match partial values!