# Compiled health, wounds, bleed, and blood volume

## Separate tracks

| Track | Stored on | Meaning |
|--------|-----------|---------|
| **Part health** | `itemizedHealth[part].health` | Structural injury — foot at 0 ≠ dead; **mobility/dodge crash** |
| **External bleed** | `itemizedHealth[part].bleed` | Open bleeding (soaks cloth; dressing helps) |
| **Internal bleed** | `itemizedHealth[part].internalBleed` | Contusion / deep bleed (no cloth soil; dressing ignored) |
| **Bruise** | `itemizedHealth[part].bruise` | 0–1 blunt residue from internal channel; **slow fade**; vulnerary accelerates; lowers lewd preferredIntensity |
| **Sprain / fracture / broken** | boolean flags | **Independent of health** (narrative or future rolls). Highest per part. Lower body → mobility/dodge; arms → attack/parry/block; chest **broken** → stamina drain ↑ + global combat ×0.88 |
| **Blood volume** | synthesized from height/weight/sex | Capacity in **liters** (Nadler-style) |
| **Blood loss** | `base.bloodLoss` | Liters lost from **both** bleed channels over time |

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

## Bleed split (on hit)

```text
bleed         = max(bleed,         damagePercent × externalFrac)
internalBleed = max(internalBleed, damagePercent × internalFrac)
```

Default from **attack mode** (`damageTypes.ts`): slash 100% ext; thrust 60/40; armed blunt 20/80; unarmed 100% int. See `bleedSplit.ts`.

| Channel | Dressing | Vulnerary | Cloth soil | Ruined undressed |
|---------|----------|-----------|------------|------------------|
| External | rate ×0.25, faster clot | rate ×0.25, full clot boost | Yes | Pins intensity to 1 |
| Internal | **no effect** | **75% efficiency** on rate cut + clot boost | No | No pin |

## Bleed over time (`tickBleed`)

Each minute:

1. `bloodLoss += totalBleedRate × dt × bleedToBloodLossScale` (**liters**) — external + internal rates
2. Direct stamina point drain from total bleed rate
3. **Cloth soil** — **external** bleed only (`bleedClothSoil.ts`)
4. Clot both channels (internal slower; vulnerary partial)
5. **Natural heal** `part.health` (bandage / vulnerary accelerate) — see below
6. Recompile HP with blood vitality factor

## Natural healing + care (`woundCare.ts`)

| State | Heal | Clot mult | Bleed rate |
|-------|------|-----------|------------|
| Baseline | glacial `naturalHealPerMinute` (~weeks for half wound) | 1× | full |
| Bandage (`dressed`) | × ~1.15 (mild) | ×3 | ×0.25 |
| Vulnerary (`vulnerary`) | × ~15 — light overnight, serious ~3 days | ×2 | ×0.25 |
| Both | multiply | multiply | ×0.0625 |

- Ruined (`health` 0) **undressed**: no heal, no clot.
- Ruined **dressed**: slow heal (`ruinedDressedHealMult`).
- Fracture / broken further slow heal.
- Care flags auto-clear when part is fully healthy and not bleeding.
- Consumables: `field-bandage`, `vulnerary-salve` (starter bank: 2 + 1).

## Files

- `bloodVolume.ts` — volume, fraction, penalties  
- `bodypartVitality.ts` — part weights + bleed tiers  
- `deriveHealthPool.ts` — compile HP  
- `tickBleed.ts` — time passage (bleed + heal)  
- `woundCare.ts` — natural heal rates, bandage / vulnerary apply  
- `performanceFromItemized.ts` — mobility/dodge from **wounds**  
