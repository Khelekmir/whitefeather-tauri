# Character sheets (source masters)

1×4 contact sheets kept as **reference sources**. Do not wire these directly into UI.

## Layout (1×4 — one row, full height)

```
[ front clothed | rear clothed | front unclothed | rear unclothed ]
```

Each figure stands approximately the **full height** of the sheet. Columns are equal width (`sheetWidth / 4`).

## Naming

- `{Name}_Static.jpg` — stiffer / more static poses  
- `{Name}_Feminine.jpg` / `{Name}_Masculine.jpg` — slightly looser poses  

Female sheets are typically 1792×1008 → cells **448×1008**.  
Male sheets are typically 1728×1152 → cells **432×1152**.

## Cropped individuals

```powershell
powershell -File scripts/cropCharacterSheets.ps1
```

Output: `public/characters/{name}/{pose}/` with

- `front_clothed.jpg`
- `rear_clothed.jpg`
- `front_unclothed.jpg`
- `rear_unclothed.jpg`
