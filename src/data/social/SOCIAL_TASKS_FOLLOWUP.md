# Social tasks — follow-up notes

Paused mid-slice to return to **Lewd Lab**. Resume from here when social content is next.

**As of:** 2026-11-04  
**Related:** `SOCIAL_INTERACTION_CHEATSHEET.md`, `socialLabScaffold.ts`, `utils/social/resolveSocialTask.ts`, `SocialLab.tsx`

---

## What landed (first cut + camp chores)

- Single catalog: `SocialTask` + `kind` (`chore|camp|travel|talk|leisure`). Task / Action / Event **not** split yet.
- Shared resolver: `resolveSocialTask` → units + relationship graph + log + effect deltas.
- Magnitudes: `SOCIAL_TASK_TUNING` in `resolveSocialTask.ts`.
- SocialLab: **Run task**; partner-required tasks disabled without a partner; shows `timeCostMinutes`.

### Live handlers

| Id | Notes |
|----|--------|
| `do_laundry` | `launderUnderwear`; partner → gratitude / warmth |
| `bathe` | Peel torso (`UNDRESS_ORDER_TORSO` via `equipGear`); clear skin soil; shame − |
| `bathe_together` | Both peel torso + bathe; mutual warmth; desireHeat if allowed |
| `share_watch` | Mutual warmth + familiarity; soft desireHeat; energy − |
| `cook_meal` | Solo pride/belonging/stress; partner gratitude to cook + warmth |
| `tend_wounds` | Dress worst 1–2 parts; optional vulnerary consume; ST care |
| `gather_firewood` | Solo pride/stress−/energy−; paired warmth/familiarity/belonging + energy− |
| `set_up_camp` | Partner required; warmth/familiarity, belonging+, stress−, energy− |
| `strike_camp` | Partner required; warmth/familiarity, pack-out stress+, energy− |
| `scout_path` | Solo pride + hazard stress + energy− + `map_intel` flag; paired trust/warmth/familiarity + partner admiration/gratitude toward scout |

Catalog handlers are fully wired (stub handler remains only for unknown ids).

Pipeline: **Assign task (plan on board) → Pass Time advances world + drips continuous task effects → completion mutations/flags → ST decay crystallizes LT**.

Camp/travel chores are relationship + pressure only (no camp-readiness / map state meters yet). Personality-clash irritation on set-up deferred. Scout injury = stress exposure only (no wound roll).

Smokes: `npx tsx scripts/smokeSocialTaskClock.ts`, `npx tsx scripts/smokeSocialCampChores.ts`.

---

## Follow-ups (when returning)

### Near-term content / polish

1. ~~Wire next chores from stubs: `gather_firewood`, `set_up_camp` / `strike_camp`.~~ **Done** (2026-11-04).
2. ~~Wire `scout_path`.~~ **Done** (2026-11-04).
3. ~~**Concurrent task clocks**~~ **Done** (2026-11-04, revised): Assign → board; Pass Time (≥5 min, ×5) drips continuous effects and fires completion; no auto time on assign. See `taskAssignmentClock.ts` / `planSocialTask.ts` / `applyTaskPlan.ts`.
4. ~~ST crystallize → durable pressures~~ **Done** (2026-11-04): faded ST chips live meters only (`ST_TO_PRESSURE_ON_CRYSTALLIZE`); anchors/baselines untouched — idle drift reasserts personality. Smoke: `npx tsx scripts/smokePressureCrystal.ts`.
5. **Idle default activities** — when free, characters independently assume RNG picks from individualized lists (talking, daydreaming, brooding, servicing gear, mending clothing, …) onto the **same** assignment board (`source: 'idleDefault'`).
6. ~~Apply **`MOOD_RECEPTIVITY`** to ST deltas~~ **Done** (2026-11-04): Option 4 thin overlay — class bond/friction × stress·belonging affect; writer mood; ST only via `moodStReceptivity.ts` + `applyTaskPlan`. Smoke: `npx tsx scripts/smokeMoodStReceptivity.ts`.
7. `tend_wounds`: optional tiny heal / `dressed` flag on patient parts.
8. Laundry: soil **all** soiled cloth layers (not only underwear); gratitude when washing *for* someone else’s kit.
9. Partner-required soft-fail is in resolver; keep UX + logs consistent as catalog grows.
10. Optional: set-up-camp personality-clash irritation gated by mood/temperament.
11. Scout: real map/travel intel state + optional wound risk roll (replacing stress-only hazard).
12. ~~Fleeting mood swings~~ **Done** (2026-11-04): embarrassment/fluster/thrill/spooked/smug on `socialStats.dynamic.moodSwings`; mood tint + ST overlay; Pass Time decay; Lab nudges + public kiss lover/hostile. Smoke: `npx tsx scripts/smokeFleetingMoodSwings.ts`.
13. ~~LT social gates~~ **Done** (2026-11-04): soft LT budget gates `share_watch` / `bathe_together` / `tend_wounds`; chores ungated. `socialBondGate.ts`. Smoke: `npx tsx scripts/smokeSocialBondGate.ts`. Outcome mults still deferred.
14. LT aggregate → durable pressure biases — **paused** (prefer LT→interaction quality→pressures).

### Shape / architecture (later)

7. Split **Task / Action / Event** catalogs when events need schedules or auto-fire on Pass Time.
8. Pass Time **world events** (meal call, invitation, rumor) using the same effect writers.
9. Schedules / camp readiness / food inventory — avoid until living-loop meters exist.
10. Full cheatsheet population remains deferred; use cheatsheet as design bible when authoring new handlers.

### Known debt

- `launderUnderwear` / soil helpers still resolve items via shared item bank (`getDetailedItem`) — fine for lab; fighter-local banks (Battleground) may need a loadout-aware laundry path later.
- Multi-slot dry / laundry UX still expanding (see also `COVERAGE.md` bleed-soil notes).
- Rust save still deferred (shapes moving).

---

## Resume checklist

1. Read `SOCIAL_TASK_TUNING` and play the six live tasks in SocialLab.
2. Pick next stub(s) from `socialLabScaffold.ts`.
3. Add handler branch in `resolveSocialTask.ts` (don’t grow `SocialLab.onRunTask`).
4. Smoke: partner-required fail, ST visible in relationship panel, Pass Time crystallize.
