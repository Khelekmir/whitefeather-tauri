# Compiled health, wounds, bleed, and blood volume

## Separate tracks

| Track | Stored on | Meaning |
|--------|-----------|---------|
| **Part health** | `itemizedHealth[part].health` | Structural injury — foot at 0 ≠ dead; **mobility/dodge crash** |
| **External bleed** | `itemizedHealth[part].bleed` | Open bleeding (soaks cloth; dressing helps) |
| **Internal bleed** | `itemizedHealth[part].internalBleed` | Active deep hemorrhage (no cloth soil; dressing ignored) |
| **Bruise** | `itemizedHealth[part].bruise` | Lasting contusion **deposited** by internal trauma; persists after bleed clots (**days**); vulnerary ×4 fade; lowers lewd preferredIntensity |
| **Lodged arrow** | `itemizedHealth[part].lodgedArrow` | Shaft in wound: plugs external rate; movement raises internal; extract spikes by head style × material |
| **Heart / lungs** | `combatStats.organs` | Integrity 1→0; thrust pierce if hard chest armor does not deter |
| **Incapacitated** | `combatStats.incapacitated` | Set on heart pierce — downed, not dead (magical healing later) |
| **Sprain / fracture / broken** | boolean flags | **Independent of health** (narrative or future rolls). Highest per part. Lower body → mobility/dodge; arms → attack/parry/block; chest **broken** → stamina drain ↑ + global combat ×0.88 |
| **Concussed** | `itemizedHealth.head.concussed` | Synced when **head.health ≤ 0.5**. Impairs **skill-gated** performance (`skillMult`: ×0.90 at threshold → ×0.62 at head=0). Clears when head heals above threshold. See `sensoryPerformance.ts`. |
| **Eyes / ears** | part health | Damaged eyes/ears cut **accuracy** (`accuracyMult`). Ears also tax dodge balance. Combined with concussion as `focusMult` for melee competence / ranged accuracy / aim spill. |
| **Arm / hand health** | shoulder→hand L/R | Strong **attack power** mult via `limbAttack.ts` (side-aware + handedness). Ruined part on a side zeros that side. Two-hand: worse arm; optional one-hand fallback. |
| **Blood volume** | synthesized from height/weight/sex | Capacity in **liters** (Nadler-style) |
| **Blood loss** | `base.bloodLoss` | Liters lost from **both** bleed channels over time |

```text
vitalityRatio   = Σ (part.health × vitalityWeight) / Σ weights
bloodRemaining  = (bloodVolume − bloodLoss) / bloodVolume
healthCurrent   = vitalityRatio × healthCap × bloodVitalityFactor(severe+)
```

Blood loss **plummets stamina** to **0 at ~40% lost** (collapse / faint). **Death at ~50% lost**.  
**Hypovolemia** slows bleed flow as blood is lost (non-arterial slows hard in the 40–50% band; no hard cap). Slower flow (care + hypo) also **hastens clotting**. HP only soft-touches at severe+ — foot wounds still matter via limp/dodge.

## Blood volume (`bloodVolume.ts`)

Mild realism from height (in) + weight (lb) + sex:

- Male ≈ Nadler: `0.3669·h³ + 0.03219·w + 0.6041` (h meters, w kg)
- Female ≈ Nadler: `0.3561·h³ + 0.03308·w + 0.1833`

Clamped to ~2.5–7.5 L for fantasy humans.

## Combat consequences of lost blood

`calcBloodCombatPenalties(remainingFraction)`:

| Lever | Role |
|--------|------|
| **stamina** | Plummets with loss; **0 at fatal (~40% lost)** + pool depleted on tick |
| **attack** | Mild fade after ~12% lost |
| **mobility / dodge** | Mild wooziness, stacked with part-health limp |
| **vitality** | Soft HP factor only at severe+ |

Hemorrhage classes (UI): none (0 lost) / slight (&gt;0–&lt;8%) / mild / moderate / severe / critical.

## Bleed split (on hit)

```text
bleed         = max(bleed,         damagePercent × externalFrac)
internalBleed = max(internalBleed, damagePercent × internalFrac)
```

Default from **attack mode** (`damageTypes.ts`): slash 100% ext; thrust 60/40; armed blunt 20/80; unarmed 100% int. See `bleedSplit.ts`.

| Channel | Dressing | Vulnerary | Cloth soil | Ruined undressed |
|---------|----------|-----------|------------|------------------|
| External | rate × `dressedExternalRateMult`, faster clot | rate × `vulneraryExternalRateMult`, full clot boost | Yes | Ruined undressed: **clot locked** until dress/pressure; intensity **relapses** toward full (no instant snap) |
| Internal | **no effect** | **75% efficiency** on rate cut + clot boost | No | No pin |
| **Direct pressure** | Alone: strong flow cut, **minor** clot. Over bandage: modest compound. Unpins clot. | — | No | Release on undressed ruin → slow relapse (`ruinedBleedRelapsePerMinute`) |

External bleed can clot fully to **0** while the wound is still unhealed.  
Lethality tuner: `bleedToBloodLossScale` — ruined undressed neck (arterial rate 10) → **~2 L in 5 min** (≈40% of ~5 L).  
Emergency path: **2 min pressure** → bandage + vulnerary + keep pressure → survive arterial fountain.

## Heart / lungs (`combatStats.organs`)

Thrust hits on chest / upper stomach may pierce organs unless **hard chest armor** (breastplate, etc.) still covers the panel.

| Event | Effect |
|-------|--------|
| **Lung pierce** | Organ integrity ↓; internal (+ mild external) bleed; **strong** stamina drain mult while injured |
| **Heart pierce** | Organ integrity ↓; **severe** external + internal bleed; set `incapacitated` (downed — not instant death; magical healing later) |

**Dagger → heart** requires **opposite-stance thrust**. Chance = `(SKL/30) × maxAt30 × profFactor(daggerRank)` where proficiency soft-caps with diminishing returns. Amberyl (low dagger / SKL) stays near the floor; Matthew (dagger expert, SKL ~17) can land it on open torso.

## Bruise (contusion) vs internal bleed

```text
On hit:  bruise = max(bruise, damage × internalFrac × fromInternalMult)
While internalBleed active: bruise may settle upward slightly; no resolution fade
After internalBleed clears: day-scale fade; deeper bruises linger longer
Vulnerary: resolution fade ×4 (strong care; milder remedies later)
```

Internal bleed is the **acute hemorrhage**. Bruise is the **lasting receipt** — it does not keep draining blood after `internalBleed` reaches 0.

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
