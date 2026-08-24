Perfect—let’s build in that **manual navigation** with **left/right arrows** and optional swipe support.

We’ll do the following:

1. Add **left/right arrow buttons** at the bottom corners of the card.
2. Let the user **cycle manually** by clicking the buttons.
3. Optionally, enable **swipe gestures** using a lightweight lib (`react-swipeable`)—I'll include that bit too.

---

### ✅ Updated `CharacterCard` with Manual Arrows + Swipe Support

```bash
npm install react-swipeable
```

Then here's the full component code:

```jsx
import React, { useState } from 'react';
import { Card, Typography, IconButton, Box } from '@mui/material';
import { ArrowBackIos, ArrowForwardIos } from '@mui/icons-material';
import { useSwipeable } from 'react-swipeable';

const CharacterCard = ({ character }) => {
    const imageKeys = ['fullbody', 'fullbodyAttacking', 'fullbodyAttackingSpecial', 'fullbodyDamaged'];
    const availableImages = imageKeys
        .filter(key => character.pictures?.[key])
        .map(key => ({ key, url: character.pictures[key] }));

    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const handleNext = () => {
        setCurrentImageIndex((prevIndex) => (prevIndex + 1) % availableImages.length);
    };

    const handlePrev = () => {
        setCurrentImageIndex((prevIndex) =>
            (prevIndex - 1 + availableImages.length) % availableImages.length
        );
    };

    const currentImage = availableImages[currentImageIndex]?.url;
    const currentKey = availableImages[currentImageIndex]?.key;

    const swipeHandlers = useSwipeable({
        onSwipedLeft: handleNext,
        onSwipedRight: handlePrev,
        trackMouse: true,
    });

    return (
        <Card
            {...swipeHandlers}
            variant="body1"
            gutterBottom
            sx={{
                border: '1px solid black',
                backgroundImage: currentImage ? `url(${currentImage})` : 'none',
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                height: '400px',
                width: '200px',
                position: 'relative',
                transition: 'background-image 0.3s ease-in-out',
                overflow: 'hidden',
            }}
        >
            {/* Character Info */}
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 1, backgroundColor: 'rgba(255,255,255,0.7)' }}>
                <Typography gutterBottom variant="h5" component="div">
                    {character.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    description: {character.description}
                </Typography>
                {character.tradeSkills &&
                    Object.entries(character.tradeSkills).map(([key, value]) => (
                        <Typography key={key}>
                            {key}: {Array.isArray(value) ? value.join(', ') : value}
                        </Typography>
                    ))}
            </Box>

            {/* Pose name */}
            <Box sx={{ position: 'absolute', bottom: 35, left: 0, right: 0, textAlign: 'center', color: 'white', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                <Typography variant="caption">{currentKey}</Typography>
            </Box>

            {/* Arrow Buttons */}
            <Box sx={{ position: 'absolute', bottom: 5, left: 5 }}>
                <IconButton onClick={handlePrev} sx={{ color: 'white', backgroundColor: 'rgba(0,0,0,0.4)' }} size="small">
                    <ArrowBackIos fontSize="small" />
                </IconButton>
            </Box>
            <Box sx={{ position: 'absolute', bottom: 5, right: 5 }}>
                <IconButton onClick={handleNext} sx={{ color: 'white', backgroundColor: 'rgba(0,0,0,0.4)' }} size="small">
                    <ArrowForwardIos fontSize="small" />
                </IconButton>
            </Box>
        </Card>
    );
};

export default CharacterCard;
```

---

### 🧠 Notes:

- `react-swipeable` adds smooth support for swipe gestures (mobile & mouse drag).
- `IconButton` from MUI wraps arrows with optional styles.
- `position: absolute` ensures elements stay fixed to card edges.
- Shows the **current pose key** (`fullbodyAttacking`, etc.) in a subtle label.

---

Want to try adding an **auto-play toggle** or maybe indicator dots like a carousel? Let me know—I'd be glad to walk you through it.