# Social tasks — follow-up notes

Paused mid-slice to return to **Lewd Lab**. Resume from here when social content is next.

**As of:** 2026-09-03  
**Related:** `SOCIAL_INTERACTION_CHEATSHEET.md`, `socialLabScaffold.ts`, `utils/social/resolveSocialTask.ts`, `SocialLab.tsx`

---

## What landed (first cut)

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

Remaining catalog rows (`gather_firewood`, camp, scout, …) still **stub** (+ tiny warmth/familiarity if paired).

Pipeline still: **task writes ST (+ pressures) → Pass Time decays ST → crystallizes LT**.

---

## Follow-ups (when returning)

### Near-term content / polish

1. Wire next chores from stubs: `gather_firewood`, `set_up_camp` / `strike_camp` (shared work → warmth, energy/stress).
2. Optional: auto **Pass Time** by `timeCostMinutes` when a task runs.
3. Apply **`MOOD_RECEPTIVITY`** to ST deltas (table exists; unused).
4. `tend_wounds`: optional tiny heal / `dressed` flag on patient parts.
5. Laundry: soil **all** soiled cloth layers (not only underwear); gratitude when washing *for* someone else’s kit.
6. Partner-required soft-fail is in resolver; keep UX + logs consistent as catalog grows.

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
