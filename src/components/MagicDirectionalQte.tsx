import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COMBAT_TUNING } from '../utils/combat/combatTuning';
import {
  defaultMagicDirectionalWindow,
  gradeMagicDirectionalInput,
  magicDirectionFromKey,
  magicQteFadeInOpacity,
  magicQteGradeLabel,
  magicQteMissLabel,
  magicQteOutlineApproach01,
  magicQteOutlineOpacity,
  scaleAtElapsedMs,
  type MagicDirectionalWindow,
  type MagicQteDirection,
  type MagicQteGradeResult,
} from '../utils/combat/magicDirectionalQte';
import { DIR_LABEL, MagicQteArrowHead } from './MagicQteArrowHeads';

export interface MagicDirectionalQteProps {
  /** Required input direction for this trial. */
  required: MagicQteDirection;
  /** Optional window override (defaults to COMBAT_TUNING.magicDirectionalQte). */
  window?: MagicDirectionalWindow;
  onResult: (result: MagicQteGradeResult) => void;
  onCancel?: () => void;
  accent?: string;
  ariaLabel?: string;
  hint?: string;
  resultHoldMs?: number;
}

type Phase = 'running' | 'resolving';

/**
 * Magical combat QTE — collapsing directional arrowhead vs center outline.
 * Pass: correct arrow/WASD within successWindowMs of perfect eclipse.
 * Chrome heights are reserved so the stage does not reflow after input.
 */
export function MagicDirectionalQte({
  required,
  window: windowProp,
  onResult,
  onCancel,
  accent = '#c4b5fd',
  ariaLabel = 'Magic directional timing',
  hint = 'Match the arrow — press the matching direction when it eclipses the outline',
  resultHoldMs,
}: MagicDirectionalQteProps) {
  const win = useMemo(
    () => windowProp ?? defaultMagicDirectionalWindow(),
    [windowProp]
  );
  const holdMs =
    resultHoldMs ?? COMBAT_TUNING.magicDirectionalQte.resultHoldMs;
  const fadeInMs = COMBAT_TUNING.magicDirectionalQte.fadeInMs;

  const [phase, setPhase] = useState<Phase>('running');
  const [scale, setScale] = useState(win.startScale);
  const [fadeOpacity, setFadeOpacity] = useState(0);
  const [flash, setFlash] = useState<MagicQteGradeResult | null>(null);

  const startMs = useRef(performance.now());
  const finished = useRef(false);
  const raf = useRef<number | null>(null);
  const winRef = useRef(win);
  winRef.current = win;
  const requiredRef = useRef(required);
  requiredRef.current = required;
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const holdMsRef = useRef(holdMs);
  holdMsRef.current = holdMs;

  const finish = useCallback((result: MagicQteGradeResult) => {
    if (finished.current) return;
    finished.current = true;
    if (raf.current != null) cancelAnimationFrame(raf.current);
    setPhase('resolving');
    setFlash(result);
    setScale(result.scale);
    setFadeOpacity(1);
    window.setTimeout(() => {
      onResultRef.current(result);
    }, Math.max(200, holdMsRef.current));
  }, []);

  useEffect(() => {
    startMs.current = performance.now();
    finished.current = false;
    setPhase('running');
    setFlash(null);
    setScale(win.startScale);
    setFadeOpacity(0);

    const tick = (now: number) => {
      if (finished.current) return;
      const w = winRef.current;
      const elapsed = now - startMs.current;
      setScale(scaleAtElapsedMs(elapsed, w));
      setFadeOpacity(magicQteFadeInOpacity(elapsed, fadeInMs));

      if (elapsed >= w.durationMs) {
        finish(
          gradeMagicDirectionalInput({
            required: requiredRef.current,
            pressed: null,
            elapsedMs: w.durationMs,
            window: w,
            timedOut: true,
          })
        );
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [required, win, finish, fadeInMs]);

  const pressDirection = useCallback(
    (pressed: MagicQteDirection) => {
      if (finished.current || phase !== 'running') return;
      const w = winRef.current;
      const elapsed = performance.now() - startMs.current;
      finish(
        gradeMagicDirectionalInput({
          required: requiredRef.current,
          pressed,
          elapsedMs: elapsed,
          window: w,
        })
      );
    },
    [finish, phase]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel?.();
        return;
      }
      if (phase !== 'running') return;
      const dir = magicDirectionFromKey(e.key);
      if (!dir) return;
      e.preventDefault();
      pressDirection(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, phase, pressDirection]);

  const flashColor =
    flash?.grade === 'crit'
      ? '#fde68a'
      : flash?.grade === 'hit'
        ? '#86efac'
        : flash
          ? '#f87171'
          : accent;
  const outlineStroke = 'rgba(255,255,255,0.55)';
  const arrowAccent =
    flash?.grade === 'crit'
      ? '#fde68a'
      : flash?.grade === 'hit'
        ? '#86efac'
        : flash?.grade === 'miss'
          ? '#f87171'
          : accent;

  return (
    <div
      role="dialog"
      aria-label={ariaLabel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(8, 4, 20, 0.72)',
        fontFamily: 'system-ui, sans-serif',
        color: '#e2e8f0',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          marginBottom: 14,
          fontSize: 13,
          opacity: 0.75,
          textAlign: 'center',
          height: 20,
          lineHeight: '20px',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          maxWidth: 'min(480px, 92vw)',
        }}
      >
        {hint}
      </div>
      <div
        style={{
          marginBottom: 10,
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: 0.4,
          color: accent,
          height: 22,
          lineHeight: '22px',
          overflow: 'hidden',
        }}
      >
        {DIR_LABEL[required]}
      </div>

      <svg
        width={280}
        height={280}
        viewBox="-1.35 -1.35 2.7 2.7"
        style={{
          overflow: 'visible',
          flexShrink: 0,
          filter: flash
            ? `drop-shadow(0 0 12px ${flashColor})`
            : `drop-shadow(0 0 8px ${accent}66)`,
        }}
      >
        <g transform="scale(1)">
          {(['up', 'down', 'left', 'right'] as MagicQteDirection[]).map((d) => {
            const approach =
              d === required ? magicQteOutlineApproach01(scale, win.startScale) : 0;
            return (
              <MagicQteArrowHead
                key={`outline-${d}`}
                direction={d}
                fill="transparent"
                stroke={outlineStroke}
                strokeWidth={0.045}
                opacity={magicQteOutlineOpacity(approach, 0.35, 0.95)}
              />
            );
          })}
        </g>

        <g transform={`scale(${scale})`} opacity={fadeOpacity}>
          <MagicQteArrowHead
            direction={required}
            fill={`${arrowAccent}cc`}
            stroke={arrowAccent}
            strokeWidth={0.05}
            opacity={0.92}
          />
        </g>

        <circle cx={0} cy={0} r={0.04} fill="rgba(255,255,255,0.35)" />
      </svg>

      <div
        style={{
          marginTop: 16,
          textAlign: 'center',
          height: 56,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {flash ? (
          <>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: 2,
                color: flashColor,
                lineHeight: '32px',
              }}
            >
              {magicQteGradeLabel(flash.grade)}
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                marginTop: 4,
                opacity: 0.9,
                lineHeight: '20px',
                whiteSpace: 'nowrap',
              }}
            >
              {flash.missKind !== 'none'
                ? `${magicQteMissLabel(flash.missKind)}${
                    flash.missKind === 'early' || flash.missKind === 'late'
                      ? ` · ${flash.timingErrorMs >= 0 ? '+' : ''}${Math.round(flash.timingErrorMs)} ms`
                      : ''
                  }`
                : `${flash.grade === 'crit' ? 'crit' : 'hit'} · ${
                    flash.timingErrorMs >= 0 ? '+' : ''
                  }${Math.round(flash.timingErrorMs)} ms`}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.5, lineHeight: '16px' }}>
            Collapse {win.durationMs} ms · window ±{Math.round(win.successWindowMs / 2)} ms · Esc
            cancel
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: 22,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 52px)',
          gridTemplateRows: 'repeat(3, 40px)',
          gap: 6,
          justifyItems: 'center',
          alignItems: 'center',
          height: 132,
          opacity: phase === 'running' ? 1 : 0.35,
          pointerEvents: phase === 'running' ? 'auto' : 'none',
        }}
      >
        <span />
        <DirPad label="↑" onClick={() => pressDirection('up')} accent={accent} />
        <span />
        <DirPad label="←" onClick={() => pressDirection('left')} accent={accent} />
        <span style={{ opacity: 0.35, fontSize: 11 }}>WASD</span>
        <DirPad label="→" onClick={() => pressDirection('right')} accent={accent} />
        <span />
        <DirPad label="↓" onClick={() => pressDirection('down')} accent={accent} />
        <span />
      </div>
    </div>
  );
}

function DirPad({
  label,
  onClick,
  accent,
}: {
  label: string;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 52,
        height: 40,
        borderRadius: 8,
        border: `1px solid ${accent}88`,
        background: 'rgba(0,0,0,0.35)',
        color: '#e2e8f0',
        fontSize: 18,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
