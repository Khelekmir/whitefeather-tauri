To query rows where the `flags` field contains the text `"Lyn"`, you can use the PostgreSQL `WHERE` clause with the `@>` operator for JSONB containment or use the `LIKE` operator for string matching. Here's how the query would look:

### Using JSONB containment (`@>`):
```sql
SELECT *
FROM armor
WHERE flags @> '{"character":"Lyn"}';
```

### Using string matching (`LIKE`):
If `flags` is stored as a JSONB field but you're searching for a text match, you can cast the `flags` to `TEXT` and use `ILIKE` for case-insensitive matching:
```sql
SELECT *
FROM armor
WHERE flags::TEXT ILIKE '%"Lyn"%';
```

Both queries will filter rows where the `flags` JSON contains `"character":"Lyn"`. If you want exact matches or case-sensitive matching, adjust accordingly.


To query a `jsonb` column in PostgreSQL and extract a specific value (like `"Amberyl"` from the `"prf"` key), you can use the `->>` operator, which gets the JSON value as text.

Here’s the correct syntax for your case:

```sql
SELECT * 
FROM public.armor 
WHERE flags->>'prf' = 'Amberyl';
```

### Explanation:
- `flags->>'prf'`: accesses the value associated with the key `"prf"` in the `jsonb` column `flags` and returns it as text.
- The `=` comparison works because you're comparing text values.

### Other useful operators:
- `->` returns a JSON object (not text).
- `->>` returns a text value.
- `#>>` allows accessing nested values using a path array (e.g., `flags#>>'{outer,inner}'` for deeper structures).

Would you also like to index this column for better performance on such queries?