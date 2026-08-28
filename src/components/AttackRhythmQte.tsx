import { useCallback, useEffect, useRef, useState } from 'react';
import {
  gradeTiming,
  rhythmGradeLabel,
  scaleRhythmWindow,
  type RhythmGrade,
  type RhythmMissKind,
  type RhythmWindow,
} from '../utils/combat/attackRhythm';

export interface AttackRhythmQteProps {
  /**
   * Pre-built window from Battleground (stance windowFactor + competence).
   * Prefer this so preview ms and live QTE share the same numbers.
   */
  rhythmWindow?: RhythmWindow;
  /** Fallback if rhythmWindow omitted — stance matchup only. */
  windowFactor?: number;
  onResult: (grade: RhythmGrade, detail: { missKind: RhythmMissKind; scale: number }) => void;
  onCancel?: () => void;
  accent?: string;
}

type Phase = 'running' | 'resolving';

/**
 * Legend of Dragoon–style timing sight: outer square rotates + shrinks onto a
 * fixed inner square. Space / Enter / click when they overlap.
 *
 * ---------------------------------------------------------------------------
 * TUNING CHEAT SHEET — what to edit for size / timing
 * ---------------------------------------------------------------------------
 *
 * Pixel size of the *drawn* squares (this file only):
 *   - `innerPx` below (~line with `const innerPx`)
 *       → absolute CSS px of the fixed inner square.
 *       → outer drawn size is `innerPx * scale`, so raising innerPx scales
 *         both squares together on screen without changing timing grades.
 *
 * Collapse distance & duration (shared combat knobs — NOT in this file):
 *   Edit `COMBAT_TUNING.rhythm` in `src/utils/combat/combatTuning.ts`:
 *   - `durationMs`   → base collapse time (ms); live duration also scales with
 *                      stance windowFactor, weapon/strike competence, and SPD.
 *   - `startScale`   → outer size at t=0 relative to inner (inner = 1.0).
 *   - `endScale`     → outer size at t=1 (should be < 1 so late presses miss).
 *   - `critBand` / `hitBand` → base closeness to 1.0 for crit / hit; tightened
 *                      by low competence and guarded stance.
 *   - `competence.*` → weapon/strike transfer floors + band/haste weights
 *                      (`rhythmCompetence.ts`, `weaponFamilies.ts`).
 *
 * Live attempt values: prefer prop `rhythmWindow` from Battleground, else
 * `scaleRhythmWindow({ windowFactor })`.
 * ---------------------------------------------------------------------------
 */
export function AttackRhythmQte({
  rhythmWindow,
  windowFactor = 1,
  onResult,
  onCancel,
  accent = '#7dd3fc',
}: AttackRhythmQteProps) {
  const initialWindow = rhythmWindow ?? scaleRhythmWindow({ windowFactor });
  const windowRef = useRef<RhythmWindow>(initialWindow);
  const [phase, setPhase] = useState<Phase>('running');
  const [scale, setScale] = useState(windowRef.current.startScale);
  const [rotation, setRotation] = useState(0);
  const [flash, setFlash] = useState<{
    grade: RhythmGrade;
    missKind: RhythmMissKind;
  } | null>(null);

  const startMs = useRef(performance.now());
  const finished = useRef(false);
  const raf = useRef<number | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const finish = useCallback(
    (grade: RhythmGrade, missKind: RhythmMissKind, atScale: number) => {
      if (finished.current) return;
      finished.current = true;
      if (raf.current != null) cancelAnimationFrame(raf.current);
      setPhase('resolving');
      setFlash({ grade, missKind });
      setScale(atScale);
      window.setTimeout(() => {
        onResultRef.current(grade, { missKind, scale: atScale });
      }, 280);
    },
    []
  );

  useEffect(() => {
    windowRef.current = rhythmWindow ?? scaleRhythmWindow({ windowFactor });
    startMs.current = performance.now();
    finished.current = false;
    setPhase('running');
    setFlash(null);
    setScale(windowRef.current.startScale);
    setRotation(0);

    const tick = (now: number) => {
      if (finished.current) return;
      const w = windowRef.current;
      // t: 0→1 over w.durationMs (tuned + competence/stance scaled).
      const t = Math.min(1, (now - startMs.current) / w.durationMs);
      // Collapsing square size ratio: startScale → endScale (tuning file).
      const nextScale = w.startScale + (w.endScale - w.startScale) * t;
      setScale(nextScale);
      setRotation(w.rotationDegrees * t);

      if (t >= 1) {
        // Timed out without a press → late miss
        finish('miss', 'late', nextScale);
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [rhythmWindow, windowFactor, finish]);

  const press = useCallback(() => {
    if (finished.current || phase !== 'running') return;
    const w = windowRef.current;
    const t = Math.min(1, (performance.now() - startMs.current) / w.durationMs);
    const graded = gradeTiming(t, w);
    finish(graded.grade, graded.missKind, graded.scale);
  }, [finish, phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel?.();
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        press();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, onCancel]);

  const w = windowRef.current;

  // --- Visual sizes (pixels on screen) ---
  // Change `innerPx` to make the fixed target square larger/smaller.
  // Outer square pixel size = innerPx × current scale (scale animates from
  // w.startScale → w.endScale; those ratios live in combatTuning.rhythm).
  const innerPx = 72;
  const outerPx = innerPx * scale;

  const flashColor =
    flash?.grade === 'crit'
      ? '#fde68a'
      : flash?.grade === 'hit'
        ? '#ffffff'
        : flash?.missKind === 'early'
          ? '#9ca3af'
          : '#60a5fa';

  return (
    <div
      role="dialog"
      aria-label="Attack timing"
      aria-modal="true"
      onClick={press}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(4, 6, 12, 0.72)',
        cursor: phase === 'running' ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          padding: 24,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 220,
            height: 220,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Hit / crit guide rings (subtle) */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              width: innerPx * (1 + w.hitBand),
              height: innerPx * (1 + w.hitBand),
              border: '1px dashed rgba(255,255,255,0.12)',
              borderRadius: 4,
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              width: innerPx * (1 + w.critBand),
              height: innerPx * (1 + w.critBand),
              border: `1px solid ${accent}44`,
              borderRadius: 3,
            }}
          />

          {/* Outer rotating / shrinking square */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              width: outerPx,
              height: outerPx,
              border: `3px solid ${flash ? flashColor : accent}`,
              borderRadius: 4,
              transform: `rotate(${rotation}deg)`,
              boxShadow: flash
                ? `0 0 24px ${flashColor}aa, 0 0 48px ${flashColor}55`
                : `0 0 12px ${accent}55`,
              transition: flash ? 'box-shadow 80ms ease' : undefined,
            }}
          />

          {/* Inner fixed square */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              width: innerPx,
              height: innerPx,
              border: `2px solid ${flash ? flashColor : 'rgba(255,255,255,0.85)'}`,
              borderRadius: 3,
              background: flash ? `${flashColor}33` : 'rgba(255,255,255,0.04)',
            }}
          />
        </div>

        <div
          style={{
            textAlign: 'center',
            color: flash ? flashColor : '#e5e7eb',
            fontWeight: 700,
            letterSpacing: 1,
            fontSize: flash ? '1.35rem' : '0.95rem',
            minHeight: 28,
          }}
        >
          {flash
            ? `${rhythmGradeLabel(flash.grade)}${
                flash.missKind !== 'none' ? ` (${flash.missKind})` : ''
              }`
            : 'Press Space / click when squares overlap'}
        </div>

        <div style={{ fontSize: 11, opacity: 0.55, color: '#e5e7eb' }}>
          Esc to cancel · window ×{w.windowFactor.toFixed(2)} · competence{' '}
          {w.competence.toFixed(2)}
        </div>

        {onCancel && phase === 'running' ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            style={{
              marginTop: 4,
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.35)',
              color: '#e5e7eb',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
