# Basic attack (Battleground)

## Hit gating

Battleground lab toggle **Use attack rhythm**:

| Mode | Behavior |
|------|----------|
| **OFF (default)** | Bypass — swing connects, then **NPC defense** rolls, else `resolveBasicAttack` |
| **ON** | Legend of Dragoon–style shrinking/rotating square QTE → `miss` / `hit` / `crit` |

- **miss** (rhythm) — no damage; attacker pays a fraction of swing stamina (`rhythm.missStaminaFraction`)
- **hit / crit / bypass** — swing connects → **NPC dodge → else parry** (`resolveNpcDefense`) → on fail, `resolveBasicAttack` (crit multiplies attack value)
- **Attacker competence** (weapon skill + strike stance, with family/general transfer floors) is the main driver of hit/crit band width and untrained collapse haste. Stance `windowFactor` remains the tactical guarded/exposed modifier. SPD eases collapse; LCK widens crit only. Weapon skill does **not** scale damage.
- **Player defender (Fighter A)** on **B→A**: defense timing QTE — **LMB/Space = dodge**, **RMB/P = parry** (`defenseRhythm.ts`). Success spends stam; miss → take the hit. Result flash holds ~1.1s.
- **NPC defender (Fighter B)** on **A→B**: chance rolls (`resolveNpcDefense`)

See `rhythmCompetence.ts`, `weaponFamilies.ts`, `attackRhythm.ts`, `AttackRhythmQte.tsx`, `combatTuning.rhythm`, `calcDefenseChances.ts`, `resolveNpcDefense.ts`.

**QTE splash:** shrinking squares overlay the defender silhouette (male/female art from targeting) and center on the aimed region bbox (`aimRegionOverlays.getAimRegionCenter`). Same viewBox as `AimTargetPanel`.

## NPC dodge / parry (chance)

Port of utils_old `DefenseTotals` + `CombatEngine` gating:

```text
finalDodge = baseDodge × healthPenalty_dodge × √(stamFrac) × weightPenalty × bloodDodge
           + gearDodge + stance.avoidanceDelta
finalParry = baseParry × healthPenalty_parry × √(stamFrac) × weightPenalty × gripMult
           + gearParry; then × stance.parryWindowFactor
```

- **healthPenalty** — `calcHealthPenalty` with `bodypartCombatModifiers` (Σ `(1−√health)×weight`, not normalized)
- **staminaPenalty** — `√(current/cap)`
- **Cover bias** — `coverHigh` ×1.1 parry; `coverLow` ×1.1 dodge (NPC % and player QTE ease)
- Order: dodge roll, else parry roll; success spends dodge/parry stamina, no part damage
- **Block** (separate, on connecting hit): shield chance → `max(0, atk − blockValue)`, skips armor; shield wear + block stam. See `calcBlockStats.ts`

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

## Armor panel durability (apply + mitigate)

Armor instances carry sparse `panelDurability` keyed by `BodyPartId` (see `data/catalog/COVERAGE.md`, `utils/items/panelDurability.ts`).

- **Wear:** base loss from `calcArmorDurabilityLoss` × `coverage[hitPart]` → that panel only; derived piece durability refreshed.
- **Mitigate:** layer mitigation × coverage × **hit-part panel fraction** — shredded `chestRight` stops protecting `chestRight`; other panels still can.
- Soft-outfit “ruined” logs when the **struck panel** hits 0.
- Shields are out of scope for panels.

## Pipeline

1. `calcMainhandAttackValue` — STR-led offense (female STR disadvantage is intentional). Weapon durability: linear intact curve (**5% → 80%**, full → 100%); at/below `brokenRatio` (~2%) the swing **collapses to punch**.
1b. **Attack mode** (`damageTypes.ts`) — slash / thrust / blunt / unarmed → bleed split (slash 100% ext; thrust 60/40; armed blunt 20/80; unarmed 100% int). Swords/daggers choose slash|thrust on Battleground.
2. Stance matchup (strike vs cover) — window factor sizes rhythm QTE; avoidance/parry window feed NPC defense
3. Rhythm grade (optional) → miss exits; hit/crit/bypass continue
4. **Defense** — B→A: player Dodge/Parry QTE; A→B: `resolveNpcDefense`. Success exits with stamina cost only
5. `pickBodyPartWithStance(aim, cover)` — body-part roll remapped by cover
6. **Block** (shield) — chance roll; on success `damage = max(0, atk − blockValue)` (**no armor mit**); shield wear + block stam
7. Else `calcCombatDamage` armor mitigation → part damage %
8. Apply itemized + pool HP
9. Soft/hard **armor wear** (skipped on block) or **shield wear** on block; outfit-ruin logs
10. **Weapon wear** by target class (hard / soft / flesh; vs shield when blocked)
11. **Stamina** — swing + hit or block costs; dodge/parry costs on successful avoid
12. Flat skill gains from `COMBAT_TUNING.training` (connect only; misses/dodges/parries skip)

## Entry

`resolveBasicAttack(attacker, defender, aimZone, opts?)` — optional `{ critMultiplier }`. Battleground keeps mutable `FighterState` clones.

## Health model

Pool HP is **compiled** from weighted itemized parts — see `HEALTH.md`. Aiming at feet no longer drains the bar like a neck wound. Bleed **rates** are computed now; clotting time-ticks come next.
