Exactly! You're right on the money.

### ✂️ `PATCH` — Partial Update

`PATCH` is used when you want to **update only a subset** of a resource’s fields — instead of replacing the entire object like `PUT` does. It's efficient, bandwidth-friendly, and semantically cleaner when you’re only changing a few values.

---

### 🔧 Example Scenario

Let’s say the armor with ID `999` was equipped and took some damage. You want to:

- Update its `armorDurability` to `92.5`
- Set `flags.unequipped` to `false`

You don’t want to send all the unchanged fields.

---

### 🛠️ PATCH Request Example

**Endpoint:** `PATCH /armors/999`  
**JSON Payload:**
```json
{
  "armorDurability": 92.5,
  "flags": {
    "unequipped": false
  }
}
```

This tells the server:
> “Only update the `armorDurability` field and set `flags.unequipped` to false — leave everything else untouched.”

---

### ⚠️ A Few Notes on PATCH:

- The **server logic** needs to support merging the updated fields into the existing resource. Not all APIs implement `PATCH` by default.
- JSON Merge Patch and JSON Patch (`application/merge-patch+json` vs `application/json-patch+json`) are two formal specs for how to format PATCH payloads — but many APIs just use partial JSON like in the example above.
- `PATCH` is **not idempotent** unless designed that way. Sending the same patch twice might apply the change twice (e.g., `+10` durability), unless it's explicitly coded to overwrite.

---

Would you like an example of a `PATCH` that removes a field or array element too?