# Item coverage — presets vs unique maps

Combat coverage for armor is resolved in `utils/items/resolveItem.ts` (`getTemplateCoverage`).

## Priority order

1. **`template.coverage`** — explicit per-item map (wins always)
2. Style / length fields on the template:
   - `underwearStyle` / `undershirtStyle`
   - `headwearStyle`
   - `garmentLength` + optional `sleeveStyle` (shirt-slot hem × sleeves)
   - `footwearLength` (foot-slot boots/shoes)
   - `sizePreset` (chest-slot plate size: small / medium / large)
3. **`DEFAULT_SLOT_COVERAGE[slot]`** — neutral fallback if nothing else is set

Shared preset tables live under `src/data/combat/` (`coveragePresets.ts`, `undergarmentCoverage.ts`).

## When to use a shared preset

Use a style field when many items share the same cut:

```ts
headwearStyle: 'halfHelm'
garmentLength: 'long'
sleeveStyle: 'none'       // orthogonal to hem
footwearLength: 'riding'
underwearStyle: 'modestPanty'
sizePreset: 'large'   // chest only
```

Examples of shared tables:

| Field | Presets (examples) |
|--------|---------------------|
| `headwearStyle` | `fullHelmet`, `halfHelm`, `hat`, `hairOrnament` |
| `garmentLength` | `tunic`, `short`, `long`, `full` (hem / hang only) |
| `sleeveStyle` | `none`, `short`, `long` (arms; merged with hem) |
| `footwearLength` | `slipper`, `shoe`, `boot`, `kneeHigh`, `riding` |
| `sizePreset` | `small`, `medium`, `large` (breastplates) |
| `underwearStyle` / `undershirtStyle` | sex-split panties, slips, bras, etc. |

### Hem × sleeves (shirt slot)

`garmentLength` and `sleeveStyle` are **orthogonal**. Resolve merges
`GARMENT_LENGTH_COVERAGE[length]` with `GARMENT_SLEEVE_COVERAGE[sleeves]`.

| Piece | Hem | Sleeves |
|-------|-----|---------|
| Amberyl linen tunic | `tunic` | `long` |
| Florina Ilian wool tunic | `short` | `short` |
| Lyn Sacaen tunic | `tunic` | `short` |
| Serra fine linen dress | `long` | `none` |

Omit `sleeveStyle` (or set `none`) for sleeveless cuts. Arm layers include `shirt` so sleeves can mitigate / take panel wear when coverage &gt; 0; sleeveless maps contribute no arm keys.

Hair ornaments (e.g. Serra’s Silk Twintail Ties) use `hairOrnament`: **negligible** combat coverage; equip value is for flags / lewd / presentation later.

## When to use unique `coverage`

You do **not** need a new entry in `HEADWEAR_COVERAGE` (or any other preset table) for a one-off item.

Put an explicit map on that template:

```ts
'dragon-visor-helm': {
  templateId: 'dragon-visor-helm',
  name: 'Dragon Visor Helm',
  itemType: 'armor',
  slot: 'head',
  material: 'adamantite',
  headwearStyle: 'fullHelmet', // optional — useful for UI / filtering
  coverage: {
    // this map is what combat uses
    head: 1,
    face: 0.9,
    eyeLeft: 0.4,
    eyeRight: 0.4,
    earLeft: 1,
    earRight: 1,
    neck: 0.5,
  },
  maxDurability: 1,
}
```

| Approach | Use when |
|----------|----------|
| Style / length preset only | Common cut shared by many items |
| `coverage: { ... }` only | Unique piece; no need to label a style |
| Both | Style for labeling; `coverage` for the real hit map |

Keys in a coverage map are `BodyPartId` values (e.g. `stomachUpper`, `thighOuterLeft`). Values are **0–1** coverage strength.

## Layers (which slots can even apply)

`src/data/combat/armorLayers.ts` lists, per body part, which equipment slots are candidates (outer → inner). An equipped piece only protects a part if:

1. Its slot is in that part’s layer list, **and**
2. Its resolved coverage for that part is **> 0**

So a long dress (`garmentLength: 'long'` on `shirt`) can cover thighs only because `shirt` is listed on thigh layers *and* the long preset sets thigh coverage above 0. A normal tunic does not.

Likewise, long sleeves protect forearms only because `shirt` is on `lowerArm*` layers *and* `sleeveStyle: 'long'` sets those keys; Serra’s `sleeveStyle: 'none'` does not.

## Related files

- Templates: `itemTemplates.ts`
- Resolve: `../../utils/items/resolveItem.ts`
- Presets: `../combat/coveragePresets.ts`, `../combat/undergarmentCoverage.ts`
- Layers: `../combat/armorLayers.ts`

---

## Instance durability (wear & tear)

**Templates** stay pristine (`maxDurability`). **Armor instances** hold:

1. **`panelDurability`** — sparse map of remaining integrity per covered `BodyPartId`
2. **`durability`** — coverage-weighted summary of those panels (UI / compat bars)

Weapons keep a scalar only. **Shields do not use panel durability yet** (deferred).

### Panel durability (armor)

Coverage keys define which areas a garment covers. On spawn (`createItemFromTemplate`):

- Every part with `coverage[part] > 0` gets a panel at `maxDurability`
- Partial coverage (e.g. tunic `hipLeft: 0.35`) still starts at full panel max; the **0.35** scales **future** wear and mitigation, not initial integrity
- Scalar `durability` = coverage-weighted average of panel fractions

Helpers: `../../utils/items/panelDurability.ts` (`initPanelDurability`, `deriveItemDurability`, …).

Example — Amberyl linen tunic (`garmentLength: 'tunic'`):

| Part | Coverage | Initial panel |
|------|----------|---------------|
| chest L/R, stomach upper/lower, oblique L/R | 1.0 | full |
| hip L/R | 0.35 | full |

A future hit on `chestRight` wears only that panel (×1.0). A hip graze wears the hip panel ×0.35. Zeroing one panel must **not** shred the whole tunic.

### Spawn / starter wear

```ts
createItemFromTemplate('caelin-breastplate', {
  id: 'unit_kent__chest',
  ownerId: 'unit_kent',
  equippedSlot: 'chest',
  durability: 0.78, // legacy: spreads 78% across all panels evenly
});
// or uneven: panelWear: { chestRight: 0.4, chestLeft: 1 }
// omit → full panels + derived scalar at max
```

Starter kits (`../starters/combatCastInventory.ts` / `STARTER_WEAR`) still pass a scalar fraction; armor spawn spreads it across panels.

The detail page durability bar reads derived `instance.durability / instance.maxDurability`, and lists per-panel integrity for armor.

### Combat apply + mitigation (wired)

| Step | Behavior |
|------|----------|
| **Wear** | `resolveBasicAttack` → `calcArmorDurabilityLoss` (base) × `coverage[hitPart]` applied to that panel only via `applyArmorPanelHitWear`; derived scalar refreshed. Soft-outfit “ruined” = **hit panel** hit 0, not the whole piece. |
| **Mitigate** | `calcCombatDamage` uses `getArmorMitigationFraction(item, hitPart)` — a shredded `chestRight` panel no longer protects `chestRight`; other panels on the same garment still can. |

### Bleed → cloth soil (wired on Pass Time)

Active bleeds soil covering garments during `tickBleed` (not on the striking hit):

- Flow = `bleedRate × minutes × bleedSoilPerRateMinute`
- Layers visited **innermost first**; each sticks `flow × coverage × absorb` (soft &gt; hard)
- Remainder × `bleedSoilBleedThrough` continues outward
- Written to `item.lewdStats.soiled.blood` (wet channel)

### Still deferred

| Phase | Work |
|-------|------|
| **Shields** | Separate schema later — not panel/coverage durability. |
| **Rust save** | Tauri/`src-tauri` item serde is **not** on the live path for recent armor/character work; add `panel_durability` when that save loop is revived. |
| **Dry-all-layers** | Pass Time currently dries underwear in lewd paths; combat tick soils any layer but full multi-slot dry/laundry UX is still expanding. |
