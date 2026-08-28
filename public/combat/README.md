# Combat pose art (Battleground flavor)

## Naming

```
{CharacterName}_{WeaponLabel}_{Atk|Def}_{High|Mid|Low}.png
```

Examples:

- `Amberyl_Dagger_Atk_Mid.png`
- `Sain_Lance_Def_High.png`

| Token | Meaning |
|-------|---------|
| CharacterName | Matches unit `name` (`Amberyl`, `Sain`, …) |
| WeaponLabel | Art family: `Dagger`, `Lance`, `Sword` (mapped from engine weapon types) |
| Atk / Def | Attacker uses **strike** stance; defender uses **cover** stance |
| High / Mid / Low | Strike/cover line |

All source poses face **right**. The UI flips **Def** images horizontally so defenders face the attacker.

## Wiring

- Manifest + resolve: `src/data/combat/combatPoseArt.ts` (`COMBAT_POSE_BASENAMES`)
- UI: `src/components/CombatPosePair.tsx` on Battleground center lane

When you add new PNGs, append their basenames to `COMBAT_POSE_BASENAMES`.
