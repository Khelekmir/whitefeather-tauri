# Compiled health, wounds, bleed, and blood volume

## Separate tracks

| Track | Stored on | Meaning |
|--------|-----------|---------|
| **Part health** | `itemizedHealth[part].health` | Structural injury — foot at 0 ≠ dead; **mobility/dodge crash** |
| **Bleed intensity** | `itemizedHealth[part].bleed` | How hard that part is bleeding |
| **Blood volume** | synthesized from height/weight/sex | Capacity in **liters** (Nadler-style) |
| **Blood loss** | `base.bloodLoss` | Liters lost from bleeding over time |

```text
vitalityRatio   = Σ (part.health × vitalityWeight) / Σ weights
bloodRemaining  = (bloodVolume − bloodLoss) / bloodVolume
healthCurrent   = vitalityRatio × healthCap × bloodVitalityFactor(severe+)
```

Blood loss **primarily** hits **stamina effectiveness** (and a bit of attack/mobility when depleted). HP only soft-touches at severe+ hemorrhage — so an axe to the foot still matters via limp/dodge, not via “instant death bar.”

## Blood volume (`bloodVolume.ts`)

Mild realism from height (in) + weight (lb) + sex:

- Male ≈ Nadler: `0.3669·h³ + 0.03219·w + 0.6041` (h meters, w kg)
- Female ≈ Nadler: `0.3561·h³ + 0.03308·w + 0.1833`

Clamped to ~2.5–7.5 L for fantasy humans.

## Combat consequences of lost blood

`calcBloodCombatPenalties(remainingFraction)`:

| Lever | Role |
|--------|------|
| **stamina** | Primary — multiplies stamina penalty in attack calc |
| **attack** | Mild fade after ~12% lost |
| **mobility / dodge** | Mild wooziness, stacked with part-health limp |
| **vitality** | Soft HP factor only at severe+ |

Hemorrhage classes (UI): none / mild / moderate / severe / critical.

## Bleed over time (`tickBleed`)

Each minute:

1. `bloodLoss += totalBleedRate × dt × bleedToBloodLossScale` (**liters**)
2. Direct stamina point drain from bleed rate
3. Clot `part.bleed` (except ruined undressed → max bleed)
4. Recompile HP with blood vitality factor

## Files

- `bloodVolume.ts` — volume, fraction, penalties  
- `bodypartVitality.ts` — part weights + bleed tiers  
- `deriveHealthPool.ts` — compile HP  
- `tickBleed.ts` — time passage  
- `performanceFromItemized.ts` — mobility/dodge from **wounds**  
