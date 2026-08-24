# Basic attack (Battleground)

Assumes **100% hit** for now — no dodge, parry, miss, or attack-rhythm.

**Stances (testing):** defender `coverHigh|Mid|Low` remaps which body parts the aim zone presents. Attacker `strikeHigh|Mid|Low` vs that cover is a same / adjacent / opposite matchup that yields an **attack window factor** (logged, not rolled). Weapon preferred-line affinity scales breakthrough. **Parry window** is separately scaled by strike line — low strikes are slightly harder to parry (`parryWindowByStrikeLine.low ≈ 0.72`). See `data/combat/stances.ts` and `calcStanceMatchup.ts`.

## Design: gear pressure (policy B)

**Hurt AND outfit wrecked** when soft-kit characters take melee.

| Target | Wounds | Gear |
|--------|--------|------|
| Unarmored / cloth (Serra, light kits) | Harsh — dodge/evade will be the real defense later | Soft outfit shreds quickly (erotic / presentation stakes) |
| Steel plate (Kent) | Mitigated | Paced wear + metal-clash bonus when hardness matches |
| Blade vs flesh/cloth | — | Weapon barely chips (energy goes into the body) |
| Blade vs plate | — | Weapon pays for the clash |

Longer-term fantasy (not wired yet):

- Male enemies may have **lower accuracy** vs females, scaled by lewd stats
- **Grapple** options instead of lethal finishes
- **Rescue** from harrowing spots → social bond / cast drama

Tuning knobs: `combatTuning.ts`.

## Pipeline

1. `calcMainhandAttackValue` — STR-led offense (female STR disadvantage is intentional)
2. Stance matchup (strike vs cover) — window factor preview; 100% hit still assumed
3. `pickBodyPartWithStance(aim, cover)` — body-part roll remapped by cover
4. `calcCombatDamage` — armor mitigation → part damage %
5. Apply itemized + pool HP
6. Soft/hard **armor wear** (`calcArmorDurabilityLoss`) + outfit-ruin log lines
7. **Weapon wear** by target class (hard / soft / flesh)
8. **Stamina** — `calcAttackerSwingStamina` (gear burden, oversized weapon vs STR, two-hand) + `calcDefenderHitStamina` (part vitality, attack force, bare/soft/hard surface, CON ratio). Dodge/parry cost helpers stubbed for QTE.
9. Tiny weapon / stance skill bumps

## Entry

`resolveBasicAttack(attacker, defender, aimZone)` — Battleground keeps mutable `FighterState` clones.

## Health model

Pool HP is **compiled** from weighted itemized parts — see `HEALTH.md`. Aiming at feet no longer drains the bar like a neck wound. Bleed **rates** are computed now; clotting time-ticks come next.
