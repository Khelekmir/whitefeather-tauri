# Basic attack (Battleground)

## Hit gating

Battleground lab toggle **Use attack rhythm**:

| Mode | Behavior |
|------|----------|
| **OFF (default)** | Bypass — swing connects, then **NPC defense** rolls, else `resolveBasicAttack` |
| **ON** | Legend of Dragoon–style shrinking/rotating square QTE → `miss` / `hit` / `crit` |

- **miss** (rhythm) — no damage; attacker pays a fraction of swing stamina (`rhythm.missStaminaFraction`)
- **hit / crit (Player→NPC, rhythm ON)** — NPC dodge/parry **carve QTE bands** (`gradeOuterScaleWithNpcDefense`): dodge at hit-band edges; parry inward + crit-band edges; clean middle → damage (crit if in crit center)
- **bypass (rhythm OFF)** — still `%` dodge→parry rolls (`resolveNpcDefense`), then damage
- **Attacker competence** (weapon skill + strike stance, with family/general transfer floors) is the main driver of hit/crit band width and untrained collapse haste. Stance `windowFactor` remains the tactical guarded/exposed modifier. SPD eases collapse; LCK widens crit only. Weapon skill does **not** scale damage.
- **Player defender (left)** on **NPC→Player**: defense timing QTE — **LMB/Space = dodge**, **RMB/P = parry** (`defenseRhythm.ts`). Attacker competence tightens the QTE. On defense fail: **attacker miss roll** (`attackerMiss.ts`, competence only, **4–33%**) may still whiff; else hit lands.
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
- **Sensory** (`sensoryPerformance.ts`) — damaged **eyes/ears** → `accuracyMult`; **concussed** (`head.health ≤ 0.5`) → `skillMult`. `focusMult = accuracy × skill` multiplies attacker competence, ranged accuracy, and aim-spill attacker score. Defender parry/block chance × `skillMult`; dodge also × ear balance. Training aptitude × `skillMult`.
- **Limb attack / handedness** (`limbAttack.ts`) — `dominantHand` (default right). Mainhand uses dominant arm chain (shoulder→hand); offhand-slot weapons use the other + **offhand skill tax** (×0.5, eased by `offhandTraining`). Side integrity = geo-mean of part health^exp with crush when a part is near-ruined (0 → useless). Two-hand grips take **min(L,R)**; if that collapses, **one-hand fallback** when STR/CON can carry the weight (power ×0.55 × feasibility). Empty mainhand + weapon in offhand = swap to the healthy hand.
- **Cover bias** — `coverHigh` ×1.1 parry; `coverLow` ×1.1 dodge (NPC % and player QTE ease)
- Order: dodge roll, else parry roll; success spends dodge/parry stamina, no part damage
- **Block** (after dodge/parry fail or cancel, connecting hit): shield chance → **aimed part fully covered** (0 wound/bleed there). `blockValue` is capacity: `excessRatio = max(0, atk/capacity − 1)`. Flat block (hit-band / NPC default) uses full excess; **redirecting** block (crit-band) counts excess ×0.5. Overload → shield-arm (`lowerArmLeft` v1) bruise + trauma flags (sprain/fracture/broken), gated by **absolute atk floors** so weak vs weak cannot break bone. Force-scaled block stam. Shield wear unchanged. See `calcBlockStats.ts`, `resolveShieldBlock.ts`. Player: second QTE (`blockRhythm`); NPC: RNG (flat). Taxes: prior mistimed dodge/parry (buckler exempt from parry tax), legs aim. Cancel on first defense QTE still opens block when shielded. Baseline: pristine steel heater ≈ equal-STR 1h sword capacity (`shieldBlock.blockValueScale`).
- **Weapon-type feel** (`weaponTypeFeel.ts` / `COMBAT_TUNING.weaponTypeFeel`): flat dodge/parry chance adds (dagger easier dodge; sword harder dodge / easier parry; lance easier dodge / harder parry) + matching player QTE band ease. Axes raise armor/outfit wear; blunt lowers gear chip (esp. soft clothes) while wound damage is unchanged.
- **Glancing blow** (`glancingBlow.ts`): after log mitigation, wound × class fraction from outermost `armorClass` (plate / chainmail / leather). Plate: slash/thrust/projectile ×0.40, blunt/unarmed ×0.70. Chain: slash ×0.55, non-bodkin projectile ×0.55. Leather: slash ×0.70, non-bodkin projectile ×0.85. Bodkin skips mail/leather glance. Partial coverage: glance chance = coverage. Wear unchanged. Bows use **projectile** mode (thrust bleed channels for now).

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
3. Rhythm (optional) → miss exits; Player→NPC zones dodge/parry into bands; NPC→Player opens defense QTE
4. **Defense** — NPC→Player: player dodge/parry QTE (+ attacker miss roll); Player→NPC bypass: `resolveNpcDefense` RNG. Band-zone dodge/parry exits with stam only
5. **Block** (shield, after dodge/parry fail or cancel) — Player: second QTE sized by adjusted `calcBlockStats.chance`, attacker competence, and strike-vs-cover `windowFactor`. Crit-band → **redirecting** (`blockStyle: 'redirect'`); hit-band → **flat**. NPC/bypass: RNG success → flat. Success → `blockOutcome: 'force'`; fail → `'skip'`. Legs aim and prior dodge/parry attempts tax chance (buckler skips parry-attempt tax)
6. `pickBodyPartWithStance(aim, cover, …, spillSkills)` — body-part roll: **skill spill** (weapon+SKL vs cover skill tightens/loosens core vs arms) then cover remap
7. Damage — on block: aimed wound **0**; `resolveShieldBlock` may bruise/traumatize shield arm from overload. Else armor mitigation → glance → part damage %
8. Apply itemized + pool HP (aimed unchanged on block; arm flags/bruise may update)
9. Soft/hard **armor wear** (skipped on block) or **shield wear** on block; outfit-ruin logs
10. **Weapon wear** by target class (hard / soft / flesh; vs shield when blocked)
11. **Stamina** — swing + hit or force-scaled block costs; dodge/parry costs on successful avoid
12. Flat skill gains from `COMBAT_TUNING.training` (connect only; misses/dodges/parries skip)

## Entry

`resolveBasicAttack(attacker, defender, aimZone, opts?)` — optional `{ critMultiplier, blockOutcome }`. Battleground keeps mutable `FighterState` clones.

## Health model

Pool HP is **compiled** from weighted itemized parts — see `HEALTH.md`. Aiming at feet no longer drains the bar like a neck wound. Bleed **rates** are computed now; clotting time-ticks come next.
