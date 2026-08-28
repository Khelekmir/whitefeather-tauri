# Durable pressures

Feed mood / social receptivity. Combat and intimacy **write** these; `resolveMood` **reads** them.

## Personalized (baseline + growth/decay)

| Id | Meaning |
|----|---------|
| stress | Load, worry |
| energy | Social/fatigue readiness (combat stamina can write into it) |
| belonging | With the group / attachment need |
| agency | Efficacy vs helplessness |
| lust | Desire (stored on `lewdStats.dynamic.lust`) |
| pride | Intact self-regard |
| shame | Mortification / loss of face |

**Resolution:** temperament blend defaults → × per-character `socialStats.static.pressureMods` (baseline offset/override, growth/decay mults).

Two Sanguine–Cholerics can differ: e.g. Amberyl is a **worrier** (higher stress baseline, faster stress growth, slower stress decay).

## Derived (no personal rates)

| Id | Meaning |
|----|---------|
| painLoad | From itemized health × vitality weights + trauma flags |

## Happiness

Legacy field / display wellbeing — prefer synthesizing later from belonging, agency, −stress, −pain, −shame, etc.
