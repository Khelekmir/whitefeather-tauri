# Item coverage — presets vs unique maps

Combat coverage for armor is resolved in `utils/items/resolveItem.ts` (`getTemplateCoverage`).

## Priority order

1. **`template.coverage`** — explicit per-item map (wins always)
2. Style / length fields on the template:
   - `underwearStyle` / `undershirtStyle`
   - `headwearStyle`
   - `garmentLength` (shirt-slot dresses/robes/tunics)
   - `footwearLength` (foot-slot boots/shoes)
   - `sizePreset` (chest-slot plate size: small / medium / large)
3. **`DEFAULT_SLOT_COVERAGE[slot]`** — neutral fallback if nothing else is set

Shared preset tables live under `src/data/combat/` (`coveragePresets.ts`, `undergarmentCoverage.ts`).

## When to use a shared preset

Use a style field when many items share the same cut:

```ts
headwearStyle: 'halfHelm'
garmentLength: 'long'
footwearLength: 'riding'
underwearStyle: 'modestPanty'
sizePreset: 'large'   // chest only
```

Examples of shared tables:

| Field | Presets (examples) |
|--------|---------------------|
| `headwearStyle` | `fullHelmet`, `halfHelm`, `hat`, `hairOrnament` |
| `garmentLength` | `tunic`, `short`, `long`, `full` |
| `footwearLength` | `slipper`, `shoe`, `boot`, `kneeHigh`, `riding` |
| `sizePreset` | `small`, `medium`, `large` (breastplates) |
| `underwearStyle` / `undershirtStyle` | sex-split panties, slips, bras, etc. |

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

## Related files

- Templates: `itemTemplates.ts`
- Resolve: `../../utils/items/resolveItem.ts`
- Presets: `../combat/coveragePresets.ts`, `../combat/undergarmentCoverage.ts`
- Layers: `../combat/armorLayers.ts`

---

## Instance durability (wear & tear)

**Templates** stay pristine (`maxDurability`). **Instances** hold current `durability`.

Spawn with wear via `createItemFromTemplate`:

```ts
createItemFromTemplate('caelin-breastplate', {
  id: 'unit_kent__chest',
  ownerId: 'unit_kent',
  equippedSlot: 'chest',
  durability: 0.78, // 78% of max left — combat / travel wear
});
// omit durability → defaults to template.maxDurability (full)
```

Starter kits apply this in `../starters/combatCastInventory.ts` through `STARTER_WEAR`: a per-character map of slot → remaining fraction (0–1), multiplied by `maxDurability` when building the kit.

The detail page durability bar reads `instance.durability / instance.maxDurability`.
