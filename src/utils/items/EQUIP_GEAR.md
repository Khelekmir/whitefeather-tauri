# Equip / unequip gear

Shared mutators in `equipGear.ts` for status, social, combat, and lewd.

## Model (v1)

```text
owned            = keys(itemsById)
equipped         = non-null unit.equipment values
unequipped owned = owned − equipped
```

No separate bag. Discard removes the item from `itemsById`.

On unequip: clear `garmentState` (displace resets); keep soil / durability / panels.

## API

| Call | Effect |
|------|--------|
| `equipItem(ctx, id, slot?)` | Wear owned item; previous occupant → unequipped-owned |
| `unequipSlot(ctx, slot)` | Clear slot; item stays owned |
| `unequipSlots(ctx, slots)` | Peel in order (skips empty) |
| `discardEquipped(ctx, slot)` | Unequip then delete from bank |
| `listEquipped` / `listUnequippedOwned` | UI helpers |

Undress helpers: `UNDRESS_ORDER_TORSO`, `UNDRESS_ORDER_BOTTOM`.

## Call sites

- **CharacterDetail (status wardrobe)** — equip / unequip / peel / discard ruined / reset starter
- **LewdLab** — recipient gear strip (equip / unequip / peel)
- **Social** — `bathe` / `bathe_together` peel torso before skin soil clear
- **Battleground** — discard ruined armor (durability ≤ 0)

Clothing barriers already ignore empty slots; after unequip, lewd access updates on the next resolve.
