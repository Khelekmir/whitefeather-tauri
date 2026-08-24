Great question — and yeah, you're totally onto something here.

### 💡 TL;DR:
**Hardcoding widths like `width: '30%'` and `width: '70%'` is okay for quick layouts**, but for better flexibility, maintainability, and responsiveness, **it’s more common to let one box size itself naturally and let the other "fill the rest"** using CSS Flexbox behavior — especially when you're already using `display: 'flex'` like in your example.

---

### 🧠 The Conventional / More Dynamic Way

Instead of hardcoding the widths like:

```tsx
<Box sx={{ width: '30%' }} />
<Box sx={{ width: '70%' }} />
```

You can let one box shrink to fit its content or give it a fixed width, and then let the second box take up the **remaining space** automatically using `flexGrow` or `flex: 1`.

Here’s a cleaner and more flexible approach:

```tsx
<Container sx={{
    height: '90vh',
    padding: 2,
    border: '10px solid blue',
    display: 'flex'
}}>

    {/* Portrait */}
    <Box sx={{
        width: '300px', // or minWidth / maxWidth if you want it responsive
        height: '100%',
        border: '1px solid green',
        backgroundColor: 'transparent',
        backgroundImage: `url(/${character.pictures.fullbodyStanding})`,
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
    }} />

    {/* Stats */}
    <Box sx={{
        flexGrow: 1, // this takes up remaining space
        height: '100%',
        border: '1px solid red',
        paddingLeft: 2 // optional spacing
    }}>
        {/* ...content... */}
    </Box>

</Container>
```

---

### 🔧 Explanation of Flex Properties:

| Property     | What it does                                        |
|--------------|-----------------------------------------------------|
| `flexGrow: 1`| Takes up **all remaining space** in the flex container |
| `flexShrink` | Shrinks when container gets too small (defaults to 1) |
| `flexBasis`  | Sets initial size before growing/shrinking |
| `flex: 1`    | Shortcut for `flexGrow: 1; flexShrink: 1; flexBasis: 0` |

---

### 📱 Bonus: Make It Responsive

You can make it responsive with breakpoints using MUI's `sx`:

```tsx
<Box sx={{
    width: { xs: '100%', sm: '300px' }, // full width on mobile, fixed on larger screens
    flexShrink: 0 // so it doesn't squish
}} />
```

---

### ✅ Summary for Notes

- Prefer **`flexGrow` / `flex`** over hardcoded percentages for dynamic sizing in Flex layouts.
- Use **fixed width** for static content (e.g., an image), and let the other content **flex** to fill the rest.
- Hardcoded `%` widths work but are **less responsive** and harder to maintain.
- Use MUI’s **responsive `sx` syntax** for mobile-first designs.

Let me know if you want a responsive version of your layout with breakpoints!