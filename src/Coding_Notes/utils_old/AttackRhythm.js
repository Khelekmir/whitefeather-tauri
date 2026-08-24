import { duration, Box } from '@mui/material';
import React, { useRef, useEffect, useState } from 'react';
import { parseCombatTotals } from './ParseCombatantTotals';

const AttackRhythm = ({
    onClose,
    onHit,
    onMiss,
    onCrit,
    combatStartTime,
    attacker,
    defender,
    timings = [],
    isOffhandAttack,
    specialAttack
}) => {
    const canvasRef = useRef(null);
    const [critFlashVisible, setCritFlashVisible] = useState(false);
    const [hitFlashVisible, setHitFlashVisible] = useState(false);
    const [missFlashVisible, setMissFlashVisible] = useState(false);
    const critFlashImageUrl = attacker.pictures.fullbodyAttackingSpecial;
    const hitFlashImageUrl = attacker.pictures.fullbodyAttacking;
    const missFlashImageUrl = attacker.pictures.fullbodyDamaged;
    const defenderImageUrl = defender.pictures.fullbodyDamaged;

    const combatInputsFinal = parseCombatTotals(attacker, defender, isOffhandAttack);

    const hitChance = combatInputsFinal.hitChance;
    const critChance = combatInputsFinal.critChance;

    // easy access for testing
    const duration = 1500; // in ms
    const hitWindow = 50 * hitChance;
    const critWindow = hitWindow * critChance;
    const attackRythmResult = [];
    const characterFadeoutTime = 1;

    timings = [
        0,
        // 800,
        // 1800,
        // 2600
    ]; // hardcoded for testing

    const instances = timings.map(time => ({
        start: combatStartTime + time,
        hit: false,
        done: false
    }))

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        let startTime = null;
        let animationFrameId;
        const innerSize = 50;
        const maxOuterSize = 1000;
        const fadeOutTime = 700;

        const fadeInPercentage = 1; // 👈 Adjust this to control fade-in length (e.g., 0.5 = 50%)
        const fadeInTime = duration * fadeInPercentage;

        const totalDuration = duration + fadeOutTime;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        function animate(time) {
            if (!startTime) startTime = time;
            const now = performance.now();

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw inner static square
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 2;
            ctx.strokeRect(centerX - innerSize / 2, centerY - innerSize / 2, innerSize, innerSize);

            let allDone = true;

            instances.forEach(inst => {
                const elapsed = now - inst.start;

                if (elapsed < 0) {
                    allDone = false;
                    return;
                }

                if (elapsed > totalDuration) {
                    inst.done = true;
                    return;
                }

                allDone = false;

                // Progress
                const progress = Math.min(elapsed / duration, 1);
                const outerSize = maxOuterSize - (maxOuterSize - innerSize) * progress;
                const rotation = progress * 0.5 * Math.PI;

                // Compute alpha (fade-in, opaque, fade-out)
                let alpha = 1;

                if (elapsed < fadeInTime) {
                    // Fade-in stage
                    alpha = elapsed / fadeInTime;
                } else if (elapsed > duration) {
                    // Fade-out stage
                    alpha = 1 - (elapsed - duration) / fadeOutTime;
                }

                ctx.globalAlpha = alpha;
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(rotation);
                ctx.strokeStyle = '#83CEF3';
                ctx.lineWidth = 2;
                ctx.strokeRect(-outerSize / 2, -outerSize / 2, outerSize, outerSize);
                ctx.restore();
                ctx.globalAlpha = 1;
            });

            if (!allDone) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                onClose();
            }
        }

        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, []);


    // Hit detection with 'w' key
    useEffect(() => {
        let inputLocked = false;
        const cooldownDuration = 100; // cooldown between keystrikes
        const handleKeyPress = (e) => {
            if (e.key.toLowerCase() !== 'w' || inputLocked) return;

            inputLocked = true;
            setTimeout(() => inputLocked = false, cooldownDuration);

            const now = performance.now();

            let critRegistered = false;
            let hitRegistered = false;

            instances.forEach(inst => {
                const targetTime = inst.start + duration;
                if (!inst.hit && Math.abs(now - targetTime) < critWindow) {
                    inst.hit = true;
                    critRegistered = true;

                    // Refresh crit flash
                    setCritFlashVisible(false);
                    setTimeout(() => setCritFlashVisible(true), 0);
                    onCrit(); // External callback
                    attackRythmResult.push('crit');
                }
            });

            if (!critRegistered) {
                instances.forEach(inst => {
                    const targetTime = inst.start + duration;
                    if (!inst.hit && Math.abs(now - targetTime) < hitWindow) {
                        inst.hit = true;
                        hitRegistered = true;

                        // Refresh hit flash
                        setHitFlashVisible(false);
                        setTimeout(() => setHitFlashVisible(true), 0);
                        onHit(); // External callback
                        attackRythmResult.push('hit');
                    }
                });
            }


            if (!hitRegistered && !critRegistered) {
                // Refresh miss flash
                setMissFlashVisible(false);
                setTimeout(() => setMissFlashVisible(true), 0);
                onMiss();
                attackRythmResult.push('miss');

            }
        };


        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, []);

    useEffect(() => {
        if (hitFlashVisible) {
            const timeout = setTimeout(() => setHitFlashVisible(false), 700);
            return () => clearTimeout(timeout);
        }
    }, [hitFlashVisible]);

    useEffect(() => {
        if (missFlashVisible) {
            const timeout = setTimeout(() => setMissFlashVisible(false), 700);
            return () => clearTimeout(timeout);
        }
    }, [missFlashVisible]);

    useEffect(() => {
        if (critFlashVisible) {
            const timeout = setTimeout(() => setCritFlashVisible(false), 700);
            return () => clearTimeout(timeout);
        }
    }, [critFlashVisible]);

    useEffect(() => {
        const preloadImages = [critFlashImageUrl, hitFlashImageUrl, missFlashImageUrl];

        preloadImages.forEach((src) => {
            if (!src) return;
            const img = new Image();
            img.src = src;
        });
    }, [critFlashImageUrl, hitFlashImageUrl, missFlashImageUrl]);

    return (
        <Box sx={{
            position: 'fixed',
            top: 0, left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 900,
            backgroundImage: `url(${defenderImageUrl})`,
            // Options: 'cover', 'contain', 'auto', or a length (like '50% 50%')
            // 'cover' scales the image to cover the whole background, possibly cropping
            // 'contain' scales the image to fit entirely inside the background, possibly leaving empty space
            // 'auto' lets the browser decide (default is 'auto')
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
        }}>
            <canvas ref={canvasRef} style={{ display: 'block', zIndex: 999 }} />
            {critFlashVisible && (
                <img
                    src={critFlashImageUrl}
                    alt="Critical Hit!"
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '25%',
                        transform: 'translate(-50%, -50%)',
                        maxHeight: '600px',
                        opacity: 0.9,
                        animation: `fadeout ${characterFadeoutTime}s ease-in-out forwards`
                    }}
                />
            )}
            {hitFlashVisible && (
                <img
                    src={hitFlashImageUrl}
                    alt="Hit!"
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '25%',
                        transform: 'translate(-50%, -50%)',
                        maxHeight: '600px',
                        opacity: 0.9,
                        animation: `fadeout ${characterFadeoutTime}s ease-in-out forwards`
                    }}
                />
            )}
            {missFlashVisible && (
                <img
                    src={missFlashImageUrl}
                    alt="Miss!"
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '25%',
                        transform: 'translate(-50%, -50%)',
                        maxHeight: '600px',
                        opacity: 0.9,
                        animation: `fadeout ${characterFadeoutTime}s ease-in-out forwards`
                    }}
                />
            )}
            <style>{`
        @keyframes fadeout {
          from { opacity: 0.9; }
          to { opacity: 0; }
        }
      `}</style>
        </Box>
    );
};

export default AttackRhythm;
