# Basic attack (Battleground)

## Hit gating

Battleground lab toggle **Use attack rhythm**:

| Mode | Behavior |
|------|----------|
| **OFF (default)** | Bypass — **100% hit**, instant `resolveBasicAttack` (`[bypass:100% hit]`) |
| **ON** | Legend of Dragoon–style shrinking/rotating square QTE → `miss` / `hit` / `crit` |

- **miss** — no damage; attacker pays a fraction of swing stamina (`rhythm.missStaminaFraction`)
- **hit** — normal resolve
- **crit** — resolve with `critAttackMultiplier` on attack value
- **Attacker competence** (weapon skill + strike stance, with family/general transfer floors) is the main driver of hit/crit band width and untrained collapse haste. Stance `windowFactor` remains the tactical guarded/exposed modifier. SPD eases collapse; LCK widens crit only. Weapon skill does **not** scale damage.
- **Defender** parry / dodge QTE still deferred (`parryWindowFactor` remains preview)

See `rhythmCompetence.ts`, `weaponFamilies.ts`, `attackRhythm.ts`, `AttackRhythmQte.tsx`, `combatTuning.rhythm`.

**Stances:** defender `coverHigh|Mid|Low` remaps which body parts the aim zone presents. Attacker `strikeHigh|Mid|Low` vs that cover is a same / adjacent / opposite matchup that yields an **attack window factor** (now also sizes the attacker QTE). Weapon preferred-line affinity scales breakthrough. **Parry window** is separately scaled by strike line — low strikes are slightly harder to parry (`parryWindowByStrikeLine.low ≈ 0.72`). See `data/combat/stances.ts` and `calcStanceMatchup.ts`.

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
2. Stance matchup (strike vs cover) — window factor sizes rhythm QTE (or ignored on bypass)
3. Rhythm grade (optional) → miss exits; hit/crit continue
4. `pickBodyPartWithStance(aim, cover)` — body-part roll remapped by cover
5. `calcCombatDamage` — armor mitigation → part damage %
6. Apply itemized + pool HP
7. Soft/hard **armor wear** (`calcArmorDurabilityLoss`) + outfit-ruin log lines
8. **Weapon wear** by target class (hard / soft / flesh)
9. **Stamina** — `calcAttackerSwingStamina` + `calcDefenderHitStamina`. Dodge/parry cost helpers stubbed for defender QTE.
10. Flat skill gains from `COMBAT_TUNING.training` (weapon + strike + cover bumps on connect; misses skip)

## Entry

`resolveBasicAttack(attacker, defender, aimZone, opts?)` — optional `{ critMultiplier }`. Battleground keeps mutable `FighterState` clones.

## Health model

Pool HP is **compiled** from weighted itemized parts — see `HEALTH.md`. Aiming at feet no longer drains the bar like a neck wound. Bleed **rates** are computed now; clotting time-ticks come next.
