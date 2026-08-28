# Blood alcohol (BAC)

Lab model for Playground / future tavern items. `SocialDynamic.BAC` is **percent** (e.g. `0.080`).

Stored at high precision so short time ticks accumulate; UI formats to 4 decimals.

## Drink input (future items)

```ts
{ volumeMl: number; abvPercent: number; kind?: 'beer' | 'wine' | 'liquor' | 'mead' }
```

## Two-compartment flow

1. **Swallow** (pace drain or gulp/mouthful/sip)  
   - Ethanol → **gut pool** (`unabsorbedEthanolG`)  
   - Tiny mucosa bump → BAC immediately (`immediateAbsorbFraction`, default 8%)

2. **Absorb over time** (first-order)  
   ```
   absorbed = gut × (1 − e^(−ka × hours))
   ΔBAC%   = (absorbed_g / (weight_g × r)) × 100
   ```
   - `ka ≈ 4.5 / hour` → most of a gut load reaches blood in **~20–30 minutes**
   - Pace scales ka (slam faster, sip slower)

3. **Metabolize** (zero-order)  
   `BAC = max(0, BAC − β × hours)` with `β ≈ 0.015 %/hr`

Widmark `r`: **0.68** male / **0.55** female. Weight from lbs → grams.

## Held drink + pace

| Pace | Glass drain | Absorption ka |
|------|-------------|---------------|
| **slam** | All remaining in **1 min** | ×1.35 |
| **quick** | 90 ml/min | ×1.15 |
| **moderate** | 45 ml/min | ×1.0 |
| **casual** | 25 ml/min | ×0.85 |
| **sip** | 10 ml/min | ×0.7 |

Mouth actions (no time): **gulp** 45 · **mouthful** 20 · **sip** 8 ml → gut (+ tiny BAC).

## Stages

Sober → Buzzed → Tipsy → Drunk → Wasted → Dangerous.

## Code

- `bacTuning.ts` — knobs  
- `bloodAlcohol.ts` — swallow / absorb / metabolize / tick  
- `data/social/sampleDrinks.ts` — presets + held drink types
