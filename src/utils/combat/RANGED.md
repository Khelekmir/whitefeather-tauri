# Ranged / bow combat (lab)

## Engagement
- Bands **1–5** → meters via `combatTuning.ranged.bandMeters`
- **Melee only at band 1**
- Bow max band = `floor(bowMaxBand × drawFrac)` where `drawFrac = clamp(0.35…1, STR / optimalDrawStr)`

## Shot pipeline
1. Range / draw gate  
2. Consume one arrow from owned bank  
3. Accuracy RNG (weapon skill + SKL + AGI soft × distance × draw × **aim precision**)  
4. On hit: attack value from draw energy × tip × mass × falloff → existing armor + **thrust** bleed split  

## Aim precision
- **Chest** — no extra accuracy tax (center mass).
- **All other aims** — tax grows with band (mild @ 1, harsh @ 5) × per-aim difficulty (head hardest, stomach mildest); weapon skill shrinks the tax.
- Tunables: `combatTuning.ranged.aimPrecision`

## Center-mass splash (chest hit location)
- Primary mass: chest / stomach / obliques / shoulders.
- Small fringe share can clip extremities (head, arms, hands, legs, feet, …).
- Fringe share rises with band and falls with skill (tighter grouping).
- Tunables: `combatTuning.ranged.chestSplash` + `data/combat/rangedAimTables.ts`

## Draw stamina
`∝ drawWeight × drawFrac / √CON` — replaces melee swing cost on a connected shot (and still paid on miss).

## Arrow composition
- **Shaft** `light | mid | heavy` → mass / falloff
- **Head style** `practice | hunting | war | bodkin` → tip base, plug, aggravation, extract spikes
- **Head material** (`item.material`) → tip × tear scale (wood soft … steel/mithril vicious)
- Starters: `arrow-practice`, `arrow-hunting`, `arrow-war`, `arrow-bodkin` (composable fields for crafting later)
- **Bodkin:** high pierce tip, solid plug, cleaner extract than hunting/war broadheads; still aggravates when the shaft wriggles

## Lodged shafts
On hit, one shaft per body part. While lodged:
- External bleed **rate** × style plug
- Pass Time / attack / dodge / parry **raise internal bleed** (style × material)
- **Extract** spikes external + internal (style × material), then clears shaft
