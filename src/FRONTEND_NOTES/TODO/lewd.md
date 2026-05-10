Perfect — here’s a clean breakdown for the **LewdStats** side using the same structure as `DefenseStatsTable`.

---

### ✅ `calcLewdTotals()` Utility Function

Create this in `utils/stats.js` (same file or separate, your call):

```js
export function calcLewdTotals(character, equipmentKeys) {
    const base = character.lewdStats.base;
    const lewd = character.lewdStats;
    const totals = {
        lust: base.lust,
        sensitivity: base.sensitivity,
        dominance: base.dominance,
        submissiveness: base.submissiveness,
        corruption: base.corruption,
    };

    equipmentKeys.forEach(slot => {
        const item = character[slot];
        if (!item) return;

        if (item.itemType === 'amulet' && item.lewdStatsBonus) {
            Object.entries(item.lewdStatsBonus).forEach(([key, value]) => {
                totals[key] += value || 0;
            });
        }
    });

    return { base, total: totals };
}
```

---

### ✅ `LewdStats.jsx` Component

```jsx
import React from 'react';
import { TableContainer, Typography, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import { useContextStore } from './ContextStore';
import { calcLewdTotals } from './utils/stats';

const LewdStats = ({ character }) => {
    const { equipmentKeys } = useContextStore();
    const { base, total } = calcLewdTotals(character, equipmentKeys);

    const rows = [
        { label: 'Lust', base: base.lust, total: total.lust },
        { label: 'Sensitivity', base: base.sensitivity, total: total.sensitivity },
        { label: 'Dominance', base: base.dominance, total: total.dominance },
        { label: 'Submissiveness', base: base.submissiveness, total: total.submissiveness },
        { label: 'Corruption', base: base.corruption, total: total.corruption },
    ];

    return (
        <TableContainer id="lewd-stat-totals" sx={{ maxWidth: 300, flex: 1 }}>
            <Typography variant="h5" component="div" align="center" sx={{ mt: 1 }}>
                Lewd Totals
            </Typography>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell><strong>Stat</strong></TableCell>
                        <TableCell><strong>Base</strong></TableCell>
                        <TableCell><strong>Total</strong></TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rows.map(({ label, base, total }) => (
                        <TableRow key={label}>
                            <TableCell>{label}</TableCell>
                            <TableCell>{base.toFixed(2)}</TableCell>
                            <TableCell>{total.toFixed(2)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default LewdStats;
```

---

### ✅ Finally: Refactor `StatSummaryPanel`

Now you can clean up `StatSummaryPanel.jsx` like this:

```jsx
import React from 'react';
import DefenseStatsTable from './DefenseStatsTable';
import LewdStats from './LewdStats';

const StatSummaryPanel = ({ character }) => {
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            <DefenseStatsTable character={character} />
            <LewdStats character={character} />
        </div>
    );
};

export default StatSummaryPanel;
```

---

Would you like me to suggest test cases or visual indicators for stat changes (e.g. highlighting changed stats)?
