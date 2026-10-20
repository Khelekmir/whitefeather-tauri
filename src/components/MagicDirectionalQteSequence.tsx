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
  magicQteResolvedFadeOpacity,
  magicSpinRotationAt,
  perfectEclipseMs,
  scaleAtElapsedMs,
  summarizeMagicSequenceResult,
  type MagicDirectionalWindow,
  type MagicQteArrowMode,
  type MagicQteDirection,
  type MagicQteGradeResult,
  type MagicQteSequenceBeatResult,
  type MagicQteSequenceResult,
  type MagicQteSequenceSpec,
} from '../utils/combat/magicDirectionalQte';
import { DIR_LABEL, MagicQteArrowHead, UP_ARROW_POINTS } from './MagicQteArrowHeads';

export interface MagicDirectionalQteSequenceProps {
  spec: MagicQteSequenceSpec;
  window?: MagicDirectionalWindow;
  onComplete: (result: MagicQteSequenceResult) => void;
  onBeat?: (result: MagicQteSequenceBeatResult) => void;
  onCancel?: () => void;
  accent?: string;
  ariaLabel?: string;
}

type LiveBeat = {
  index: number;
  direction: MagicQteDirection;
  trueDirection: MagicQteDirection;
  arrowMode: MagicQteArrowMode;
  /** Signed relative spin across collapse; tip lands on `direction` at eclipse. */
  spinDegrees: number;
  startAtMs: number;
  /** Visible once sequence elapsed ≥ startAtMs. */
  spawned: boolean;
  scale: number;
  /** Glyph rotation degrees (spinning mode); upright directional uses DIR_ROTATION. */
  rotationDeg: number;
  fadeOpacity: number;
  resolved: boolean;
  /** Sequence elapsed ms when this beat resolved (drives result fade-out). */
  resolvedAtSeqMs: number | null;
  result: MagicQteGradeResult | null;
};

function beatStatusLabel(b: LiveBeat): string {
  if (b.arrowMode === 'hidden') return 'eclipse (hidden)';
  if (b.arrowMode === 'spinning') return 'spin → eclipse';
  return DIR_LABEL[b.direction];
}

/**
 * Multi-beat magical QTE — spell formula with staggered collapsing arrows.
 * Beats may overlap; each fades in. Layout chrome is fixed (no reflow on resolve).
 */
export function MagicDirectionalQteSequence({
  spec,
  window: windowProp,
  onComplete,
  onBeat,
  onCancel,
  accent = '#c4b5fd',
  ariaLabel = 'Magic directional sequence',
}: MagicDirectionalQteSequenceProps) {
  const win = useMemo(
    () => windowProp ?? defaultMagicDirectionalWindow(),
    [windowProp]
  );
  const T = COMBAT_TUNING.magicDirectionalQte;
  const perfectMs = perfectEclipseMs(win);

  const initialBeats = useMemo<LiveBeat[]>(
    () =>
      spec.beats.map((b, index) => {
        const spinDegrees = b.spinDegrees ?? 0;
        const arrowMode = b.arrowMode ?? 'directional';
        const direction = b.direction;
        return {
          index,
          direction,
          trueDirection: b.trueDirection ?? direction,
          arrowMode,
          spinDegrees,
          startAtMs: b.startAtMs,
          spawned: false,
          scale: win.startScale,
          rotationDeg:
            arrowMode === 'spinning'
              ? magicSpinRotationAt(0, win, direction, spinDegrees)
              : 0,
          fadeOpacity: 0,
          resolved: false,
          resolvedAtSeqMs: null,
          result: null,
        };
      }),
    [spec, win]
  );

  const [beats, setBeats] = useState<LiveBeat[]>(initialBeats);
  const [seqElapsed, setSeqElapsed] = useState(0);
  const [finished, setFinished] = useState(false);

  const startMs = useRef(performance.now());
  const beatsRef = useRef(beats);
  beatsRef.current = beats;
  const winRef = useRef(win);
  winRef.current = win;
  const finishedRef = useRef(false);
  const completingRef = useRef(false);
  const raf = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onBeatRef = useRef(onBeat);
  onBeatRef.current = onBeat;
  const specRef = useRef(spec);
  specRef.current = spec;

  const completeIfDone = useCallback((nextBeats: LiveBeat[]) => {
    if (completingRef.current) return;
    if (!nextBeats.every((b) => b.resolved)) return;
    completingRef.current = true;
    setFinished(true);
    // Keep RAF alive so resolved arrows can finish fading out during the hold.

    const beatResults: MagicQteSequenceBeatResult[] = nextBeats.map((b) => ({
      ...(b.result as MagicQteGradeResult),
      beatIndex: b.index,
      startAtMs: b.startAtMs,
    }));
    const payload: MagicQteSequenceResult = summarizeMagicSequenceResult(
      specRef.current.id,
      beatResults
    );
    const holdMs = Math.max(
      200,
      T.sequenceEndHoldMs,
      T.resolvedFadeOutMs + 80
    );
    window.setTimeout(() => {
      finishedRef.current = true;
      if (raf.current != null) cancelAnimationFrame(raf.current);
      onCompleteRef.current(payload);
    }, holdMs);
  }, [T.sequenceEndHoldMs, T.resolvedFadeOutMs]);

  const resolveBeat = useCallback(
    (index: number, result: MagicQteGradeResult) => {
      if (finishedRef.current || completingRef.current) return;
      const resolvedAtSeqMs = performance.now() - startMs.current;
      setBeats((prev) => {
        const cur = prev[index];
        if (!cur || cur.resolved) return prev;
        const w = winRef.current;
        const age = Math.max(0, resolvedAtSeqMs - cur.startAtMs);
        const tNorm = Math.min(1, age / Math.max(1, w.durationMs));
        const rotationDeg =
          cur.arrowMode === 'spinning'
            ? magicSpinRotationAt(tNorm, w, cur.direction, cur.spinDegrees)
            : cur.rotationDeg;
        const next = prev.map((b, i) =>
          i === index
            ? {
                ...b,
                resolved: true,
                resolvedAtSeqMs,
                result,
                scale: result.scale,
                rotationDeg,
                fadeOpacity: 1,
              }
            : b
        );
        const beatResult: MagicQteSequenceBeatResult = {
          ...result,
          beatIndex: index,
          startAtMs: cur.startAtMs,
        };
        onBeatRef.current?.(beatResult);
        completeIfDone(next);
        return next;
      });
    },
    [completeIfDone]
  );

  useEffect(() => {
    startMs.current = performance.now();
    finishedRef.current = false;
    completingRef.current = false;
    setFinished(false);
    setBeats(initialBeats);
    setSeqElapsed(0);

    const tick = (now: number) => {
      if (finishedRef.current) return;
      const elapsed = now - startMs.current;
      setSeqElapsed(elapsed);
      const w = winRef.current;
      const prev = beatsRef.current;
      const timedOut: { index: number; result: MagicQteGradeResult }[] = [];
      const fadeOutMs = T.resolvedFadeOutMs;

      const next = prev.map((b) => {
        if (b.resolved) {
          const since = elapsed - (b.resolvedAtSeqMs ?? elapsed);
          const fadeOpacity = magicQteResolvedFadeOpacity(since, fadeOutMs);
          return fadeOpacity === b.fadeOpacity ? b : { ...b, fadeOpacity };
        }
        if (completingRef.current) return b;
        if (elapsed < b.startAtMs) {
          return b.spawned ? { ...b, spawned: false, fadeOpacity: 0 } : b;
        }
        const age = elapsed - b.startAtMs;
        const tNorm = Math.min(1, age / Math.max(1, w.durationMs));
        const rotationDeg =
          b.arrowMode === 'spinning'
            ? magicSpinRotationAt(tNorm, w, b.direction, b.spinDegrees)
            : b.rotationDeg;
        if (age >= w.durationMs) {
          const result = gradeMagicDirectionalInput({
            required: b.direction,
            pressed: null,
            elapsedMs: w.durationMs,
            window: w,
            timedOut: true,
          });
          timedOut.push({ index: b.index, result });
          return {
            ...b,
            spawned: true,
            resolved: true,
            resolvedAtSeqMs: elapsed,
            result,
            scale: result.scale,
            rotationDeg,
            fadeOpacity: 1,
          };
        }
        return {
          ...b,
          spawned: true,
          scale: scaleAtElapsedMs(age, w),
          rotationDeg,
          fadeOpacity: magicQteFadeInOpacity(age, T.fadeInMs),
        };
      });

      beatsRef.current = next;
      setBeats(next);
      for (const t of timedOut) {
        const beat = next[t.index]!;
        onBeatRef.current?.({
          ...t.result,
          beatIndex: t.index,
          startAtMs: beat.startAtMs,
        });
      }
      if (timedOut.length) completeIfDone(next);

      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [initialBeats, completeIfDone, T.fadeInMs, T.resolvedFadeOutMs]);

  const pressDirection = useCallback(
    (pressed: MagicQteDirection) => {
      if (finishedRef.current || completingRef.current) return;
      const elapsed = performance.now() - startMs.current;
      const w = winRef.current;
      const live = beatsRef.current;

      const active = live.filter(
        (b) =>
          !b.resolved &&
          b.spawned &&
          elapsed >= b.startAtMs &&
          elapsed < b.startAtMs + w.durationMs
      );
      if (active.length === 0) return;

      const matching = active.filter((b) => b.direction === pressed);
      let target: LiveBeat;
      if (matching.length > 0) {
        // Prefer the matching beat closest to its perfect eclipse.
        target = matching.reduce((best, b) => {
          const err = Math.abs(elapsed - b.startAtMs - perfectMs);
          const bestErr = Math.abs(elapsed - best.startAtMs - perfectMs);
          return err < bestErr ? b : best;
        });
      } else {
        // Wrong direction — fail earliest active beat.
        target = active.reduce((a, b) => (a.startAtMs <= b.startAtMs ? a : b));
      }

      const age = elapsed - target.startAtMs;
      const result = gradeMagicDirectionalInput({
        required: target.direction,
        pressed,
        elapsedMs: age,
        window: w,
      });
      resolveBeat(target.index, result);
    },
    [perfectMs, resolveBeat]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel?.();
        return;
      }
      if (finished) return;
      const dir = magicDirectionFromKey(e.key);
      if (!dir) return;
      e.preventDefault();
      pressDirection(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finished, onCancel, pressDirection]);

  const outlineStroke = 'rgba(255,255,255,0.55)';
  const fullyDirectional = beats.every((b) => b.arrowMode === 'directional');
  const patternLabel = fullyDirectional
    ? spec.beats.map((b) => DIR_LABEL[b.direction]).join('  ·  ')
    : `timing ${spec.timingsKnown ?? '—'}/${beats.length} · dirs ${spec.directionsKnown ?? '—'}/${beats.length}`;
  const resolvedCount = beats.filter((b) => b.resolved).length;
  const hitCount = beats.filter(
    (b) => b.result?.grade === 'hit' || b.result?.grade === 'crit'
  ).length;
  const critCount = beats.filter((b) => b.result?.grade === 'crit').length;

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
          marginBottom: 10,
          fontSize: 13,
          opacity: 0.75,
          textAlign: 'center',
          height: 42,
          lineHeight: '20px',
          overflow: 'hidden',
        }}
      >
        <div>{spec.label}</div>
        <div style={{ opacity: 0.85, marginTop: 2 }}>{patternLabel}</div>
      </div>

      <div
        style={{
          marginBottom: 8,
          fontSize: 13,
          fontWeight: 600,
          color: accent,
          height: 20,
          lineHeight: '20px',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        Beat {Math.min(resolvedCount + 1, beats.length)} / {beats.length}
        {resolvedCount > 0
          ? ` · ${hitCount} hit · ${critCount} crit`
          : ''}
      </div>

      <svg
        width={280}
        height={280}
        viewBox="-1.35 -1.35 2.7 2.7"
        style={{
          overflow: 'visible',
          flexShrink: 0,
          filter: `drop-shadow(0 0 8px ${accent}66)`,
        }}
      >
        {/* Shared center outline — brightens as collapsing glyphs approach. */}
        <g transform="scale(1)">
          {(['up', 'down', 'left', 'right'] as MagicQteDirection[]).map((d) => {
            let approach = 0;
            for (const b of beats) {
              if (!b.spawned || b.resolved) continue;
              const contributes =
                b.arrowMode === 'directional'
                  ? b.direction === d
                  : true; // spinning/hidden: whole cross eclipses together
              if (!contributes) continue;
              approach = Math.max(
                approach,
                magicQteOutlineApproach01(b.scale, win.startScale)
              );
            }
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

        {beats.map((b) => {
          if ((!b.spawned && !b.resolved) || b.fadeOpacity < 0.02) return null;
          if (b.arrowMode === 'hidden' && !b.resolved) return null;
          const color =
            b.result?.grade === 'crit'
              ? '#fde68a'
              : b.result?.grade === 'hit'
                ? '#86efac'
                : b.result?.grade === 'miss'
                  ? '#f87171'
                  : accent;
          if (b.arrowMode === 'spinning') {
            return (
              <g
                key={`beat-${b.index}`}
                transform={`scale(${b.scale}) rotate(${b.rotationDeg})`}
                opacity={b.fadeOpacity}
              >
                <polygon
                  points={UP_ARROW_POINTS}
                  fill={`${color}99`}
                  stroke={color}
                  strokeWidth={0.05}
                  strokeLinejoin="round"
                  opacity={0.9}
                />
              </g>
            );
          }
          return (
            <g
              key={`beat-${b.index}`}
              transform={`scale(${b.scale})`}
              opacity={b.fadeOpacity}
            >
              <MagicQteArrowHead
                direction={b.direction}
                fill={`${color}b3`}
                stroke={color}
                strokeWidth={0.05}
                opacity={0.9}
              />
            </g>
          );
        })}

        <circle cx={0} cy={0} r={0.04} fill="rgba(255,255,255,0.35)" />
      </svg>

      <div
        style={{
          marginTop: 16,
          height: Math.max(72, beats.length * 20),
          width: 'min(420px, 90vw)',
          textAlign: 'center',
          fontSize: 12,
          lineHeight: '20px',
          opacity: 0.85,
          overflow: 'hidden',
        }}
      >
        {beats.map((b) => {
          if (!b.result) {
            return (
              <div
                key={`status-${b.index}`}
                style={{ height: 20, opacity: b.spawned ? 0.7 : 0.35 }}
              >
                {b.index + 1}. {beatStatusLabel(b)}
                {b.spawned
                  ? ' · live'
                  : ` · in ${Math.max(0, Math.round(b.startAtMs - seqElapsed))} ms`}
              </div>
            );
          }
          const miss = magicQteMissLabel(b.result.missKind);
          const shownDir =
            b.arrowMode === 'directional'
              ? DIR_LABEL[b.direction]
              : beatStatusLabel(b);
          return (
            <div
              key={`status-${b.index}`}
              style={{
                height: 20,
                color:
                  b.result.grade === 'crit'
                    ? '#fde68a'
                    : b.result.grade === 'hit'
                      ? '#86efac'
                      : '#f87171',
                fontWeight: 600,
              }}
            >
              {b.index + 1}. {shownDir} · {magicQteGradeLabel(b.result.grade)}
              {miss
                ? ` · ${miss}`
                : ` · Δ ${Math.round(b.result.timingErrorMs)} ms`}
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 18,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 52px)',
          gridTemplateRows: 'repeat(3, 40px)',
          gap: 6,
          justifyItems: 'center',
          alignItems: 'center',
          height: 132,
          opacity: finished ? 0.35 : 1,
          pointerEvents: finished ? 'none' : 'auto',
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

      <div
        style={{
          marginTop: 12,
          fontSize: 11,
          opacity: 0.45,
          height: 16,
          lineHeight: '16px',
          overflow: 'hidden',
        }}
      >
        Stagger {T.sequenceStaggerMs} ms · fade-in {T.fadeInMs} ms · fade-out{' '}
        {T.resolvedFadeOutMs} ms · Esc cancel
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
