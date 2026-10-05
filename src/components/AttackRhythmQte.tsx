import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  gradeOuterScale,
  gradeOuterScaleWithNpcDefense,
  gradeTiming,
  defenseRhythmGradeLabel,
  rhythmGradeLabel,
  scaleRhythmWindow,
  type AttackTimingZone,
  type RhythmGrade,
  type RhythmMissKind,
  type RhythmWindow,
} from '../utils/combat/attackRhythm';
import type { DefenseVerb } from '../utils/combat/defenseRhythm';
import type { AttackTargetKey } from '../data/combat/attackTargets';
import {
  AIM_VIEWBOX,
  getAimRegionCenter,
  getAimRegionsForSex,
} from '../data/combat/aimRegionOverlays';
import type { Sex } from '../types/characters';
import { AIM_ZONE_LABELS } from './AimTargetPanel';

const SILHOUETTE_SRC: Record<Sex, string> = {
  M: '/combat/silhouette_male_front.jpg',
  F: '/combat/silhouette_female_front.jpg',
};

export interface RhythmSplashTarget {
  /** Defender (or self when defending) sex → silhouette art. */
  sex: Sex;
  /** Aimed zone — QTE squares center on this region's bbox. */
  aim: AttackTargetKey;
}

export interface AttackRhythmQteProps {
  /**
   * Pre-built window from Battleground (stance windowFactor + competence).
   * Prefer this so preview ms and live QTE share the same numbers.
   */
  rhythmWindow?: RhythmWindow;
  /** Fallback if rhythmWindow omitted — stance matchup only. */
  windowFactor?: number;
  onResult: (
    grade: RhythmGrade,
    detail: {
      missKind: RhythmMissKind;
      scale: number;
      /** Set when defense L/R click mode is active. */
      verb?: DefenseVerb;
      /** Player→NPC: zoned outcome including NPC dodge/parry band edges. */
      zone?: AttackTimingZone;
    }
  ) => void;
  onCancel?: () => void;
  accent?: string;
  /** Dialog label — attack vs dodge/parry. */
  ariaLabel?: string;
  /** Short instruction under the square. */
  hint?: string;
  /**
   * How long to show the result flash before calling onResult (ms).
   * Default ~900 so grades stay readable.
   */
  resultHoldMs?: number;
  /**
   * Player defense: LMB / Space = dodge, RMB = parry (if canParry).
   * Visual animation uses dodgeWindow; grading uses each verb's hit/crit bands
   * against the shared outer scale.
   */
  defenseInput?: {
    canParry: boolean;
    dodgeWindow: RhythmWindow;
    parryWindow: RhythmWindow;
  };
  /**
   * Player shield-block QTE (after dodge/parry fail): Space / LMB / click.
   * Grades against `rhythmWindow`; flash uses block labels.
   */
  blockMode?: boolean;
  /**
   * Player→NPC attack QTE: carve defender dodge/parry % into hit/crit band edges
   * for grading + flash labels (NPC DODGE / NPC PARRY vs HIT / CRIT).
   */
  npcDefenseZones?: {
    dodge: number;
    parry: number;
  };
  /**
   * Character splash: silhouette + aim-region overlay; QTE squares centered
   * on the targeted zone (viewBox-aligned with AimTargetPanel).
   */
  splash?: RhythmSplashTarget;
  /**
   * Lab/testing: keep the outer square axis-aligned (no spin) so eclipse
   * of outer→inner is easier to read.
   */
  freezeRotation?: boolean;
}

function attackZoneFlashLabel(zone: AttackTimingZone): string {
  switch (zone) {
    case 'dodge':
      return 'NPC DODGE';
    case 'parry':
      return 'NPC PARRY';
    case 'crit':
      return 'CRIT';
    case 'hit':
      return 'HIT';
    case 'miss':
      return 'MISS';
  }
}

function zoneToRhythmGrade(zone: AttackTimingZone): RhythmGrade {
  if (zone === 'crit') return 'crit';
  if (zone === 'hit') return 'hit';
  return 'miss';
}

type Phase = 'running' | 'resolving';

/**
 * Legend of Dragoon–style timing sight: outer square rotates + shrinks onto a
 * fixed inner square.
 *
 * With `splash`, art fills the stage and squares sit on the aim region's center
 * (male/female silhouette + polygons from aimRegionOverlays).
 *
 * ---------------------------------------------------------------------------
 * TUNING CHEAT SHEET — what to edit for size / timing
 * ---------------------------------------------------------------------------
 *
 * Pixel size of the *drawn* squares (this file only):
 *   - `innerFrac` — inner square as fraction of splash height (default ~0.11).
 *   - Splash stage width: `splashMaxWidth` (~min(420, 52vh)).
 *
 * Collapse distance & duration (shared combat knobs — NOT in this file):
 *   Edit `COMBAT_TUNING.rhythm` / `defenseRhythm` in combatTuning.ts.
 * ---------------------------------------------------------------------------
 */
export function AttackRhythmQte({
  rhythmWindow,
  windowFactor = 1,
  onResult,
  onCancel,
  accent = '#7dd3fc',
  ariaLabel = 'Attack timing',
  hint = 'Space / Enter / click when squares overlap',
  resultHoldMs = 900,
  defenseInput,
  blockMode = false,
  npcDefenseZones,
  splash,
  freezeRotation = false,
}: AttackRhythmQteProps) {
  const initialWindow =
    defenseInput?.dodgeWindow ??
    rhythmWindow ??
    scaleRhythmWindow({ windowFactor });
  const windowRef = useRef<RhythmWindow>(initialWindow);
  const defenseRef = useRef(defenseInput);
  defenseRef.current = defenseInput;
  const blockModeRef = useRef(blockMode);
  blockModeRef.current = blockMode;
  const freezeRotationRef = useRef(freezeRotation);
  freezeRotationRef.current = freezeRotation;
  const npcZonesRef = useRef(npcDefenseZones);
  npcZonesRef.current = npcDefenseZones;
  const [phase, setPhase] = useState<Phase>('running');
  const [scale, setScale] = useState(windowRef.current.startScale);
  const [rotation, setRotation] = useState(0);
  const [flash, setFlash] = useState<{
    grade: RhythmGrade;
    missKind: RhythmMissKind;
    verb?: DefenseVerb;
    zone?: AttackTimingZone;
  } | null>(null);
  const [parryDenied, setParryDenied] = useState(false);

  const startMs = useRef(performance.now());
  const finished = useRef(false);
  const raf = useRef<number | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const holdMsRef = useRef(resultHoldMs);
  holdMsRef.current = resultHoldMs;

  const aimCenter = useMemo(() => {
    if (!splash) return null;
    return getAimRegionCenter(splash.sex, splash.aim);
  }, [splash]);

  const regions = useMemo(
    () => (splash ? getAimRegionsForSex(splash.sex) : []),
    [splash]
  );

  const finish = useCallback(
    (
      grade: RhythmGrade,
      missKind: RhythmMissKind,
      atScale: number,
      verb?: DefenseVerb,
      zone?: AttackTimingZone
    ) => {
      if (finished.current) return;
      finished.current = true;
      if (raf.current != null) cancelAnimationFrame(raf.current);
      setPhase('resolving');
      setFlash({ grade, missKind, verb, zone });
      setScale(atScale);
      window.setTimeout(() => {
        onResultRef.current(grade, { missKind, scale: atScale, verb, zone });
      }, Math.max(200, holdMsRef.current));
    },
    []
  );

  useEffect(() => {
    windowRef.current =
      defenseInput?.dodgeWindow ??
      rhythmWindow ??
      scaleRhythmWindow({ windowFactor });
    startMs.current = performance.now();
    finished.current = false;
    setPhase('running');
    setFlash(null);
    setParryDenied(false);
    setScale(windowRef.current.startScale);
    setRotation(0);

    const tick = (now: number) => {
      if (finished.current) return;
      const w = windowRef.current;
      const t = Math.min(1, (now - startMs.current) / w.durationMs);
      const nextScale = w.startScale + (w.endScale - w.startScale) * t;
      setScale(nextScale);
      setRotation(
        freezeRotationRef.current ? 0 : w.rotationDegrees * t
      );

      if (t >= 1) {
        const zones = npcZonesRef.current;
        if (zones) {
          const zoned = gradeOuterScaleWithNpcDefense(
            nextScale,
            w,
            zones.dodge,
            zones.parry
          );
          finish(
            zoneToRhythmGrade(zoned.outcome),
            zoned.missKind === 'none' ? 'late' : zoned.missKind,
            nextScale,
            undefined,
            zoned.outcome === 'miss' ? 'miss' : zoned.outcome
          );
        } else if (blockModeRef.current) {
          finish('miss', 'late', nextScale, 'block');
        } else {
          finish('miss', 'late', nextScale);
        }
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [rhythmWindow, windowFactor, defenseInput, finish]);

  const pressDefense = useCallback(
    (verb: DefenseVerb) => {
      if (finished.current || phase !== 'running') return;
      const def = defenseRef.current;
      if (!def) return;
      if (verb === 'parry' && !def.canParry) {
        setParryDenied(true);
        window.setTimeout(() => setParryDenied(false), 700);
        return;
      }
      const w = windowRef.current;
      const t = Math.min(1, (performance.now() - startMs.current) / w.durationMs);
      const atScale = w.startScale + (w.endScale - w.startScale) * t;
      const bands =
        verb === 'dodge'
          ? def.dodgeWindow
          : {
              ...w,
              critBand: def.parryWindow.critBand,
              hitBand: def.parryWindow.hitBand,
            };
      const graded = gradeOuterScale(atScale, bands);
      finish(graded.grade, graded.missKind, atScale, verb);
    },
    [finish, phase]
  );

  const press = useCallback(() => {
    if (finished.current || phase !== 'running') return;
    if (defenseRef.current) {
      pressDefense('dodge');
      return;
    }
    const w = windowRef.current;
    const t = Math.min(1, (performance.now() - startMs.current) / w.durationMs);
    const scaleNow = w.startScale + (w.endScale - w.startScale) * t;
    if (blockModeRef.current) {
      const graded = gradeOuterScale(scaleNow, w);
      finish(graded.grade, graded.missKind, scaleNow, 'block');
      return;
    }
    const zones = npcZonesRef.current;
    if (zones) {
      const zoned = gradeOuterScaleWithNpcDefense(
        scaleNow,
        w,
        zones.dodge,
        zones.parry
      );
      const grade = zoneToRhythmGrade(zoned.outcome);
      finish(grade, zoned.missKind, scaleNow, undefined, zoned.outcome);
      return;
    }
    const graded = gradeTiming(t, w);
    finish(graded.grade, graded.missKind, graded.scale);
  }, [finish, phase, pressDefense]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel?.();
        return;
      }
      if (defenseRef.current) {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          pressDefense('dodge');
          return;
        }
        if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          pressDefense('parry');
          return;
        }
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        press();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, pressDefense, onCancel]);

  const w = windowRef.current;
  const defenseMode = !!defenseInput;
  const isBlockMode = !!blockMode;

  // Square size: fraction of splash stage height, or fixed px without splash.
  const splashMaxWidth = 400;
  const stageHeightGuess = splashMaxWidth * 1.5; // 2:3
  const innerPx = splash
    ? Math.round(stageHeightGuess * 0.11)
    : 72;
  const outerPx = innerPx * scale;

  const flashColor =
    flash?.grade === 'crit'
      ? '#fde68a'
      : flash?.grade === 'hit'
        ? '#ffffff'
        : flash?.missKind === 'early'
          ? '#9ca3af'
          : '#60a5fa';

  const shownHint = parryDenied
    ? 'No weapon to parry — LMB / Space to dodge'
    : hint;

  const centerLeftPct = aimCenter
    ? (aimCenter.x / AIM_VIEWBOX.width) * 100
    : 50;
  const centerTopPct = aimCenter
    ? (aimCenter.y / AIM_VIEWBOX.height) * 100
    : 50;

  const squares = (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: `${centerLeftPct}%`,
        top: `${centerTopPct}%`,
        width: 0,
        height: 0,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 3,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: innerPx * (1 + w.hitBand),
          height: innerPx * (1 + w.hitBand),
          marginLeft: -(innerPx * (1 + w.hitBand)) / 2,
          marginTop: -(innerPx * (1 + w.hitBand)) / 2,
          border: '1px dashed rgba(255,255,255,0.18)',
          borderRadius: 4,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: innerPx * (1 + w.critBand),
          height: innerPx * (1 + w.critBand),
          marginLeft: -(innerPx * (1 + w.critBand)) / 2,
          marginTop: -(innerPx * (1 + w.critBand)) / 2,
          border: `1px solid ${accent}55`,
          borderRadius: 3,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: outerPx,
          height: outerPx,
          marginLeft: -outerPx / 2,
          marginTop: -outerPx / 2,
          border: `3px solid ${flash ? flashColor : accent}`,
          borderRadius: 4,
          transform: `rotate(${rotation}deg)`,
          boxShadow: flash
            ? `0 0 24px ${flashColor}aa, 0 0 48px ${flashColor}55`
            : `0 0 14px ${accent}66`,
          transition: flash ? 'box-shadow 80ms ease' : undefined,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: innerPx,
          height: innerPx,
          marginLeft: -innerPx / 2,
          marginTop: -innerPx / 2,
          border: `2px solid ${flash ? flashColor : 'rgba(255,255,255,0.9)'}`,
          borderRadius: 3,
          background: flash ? `${flashColor}33` : 'rgba(255,255,255,0.06)',
        }}
      />
    </div>
  );

  return (
    <div
      role="dialog"
      aria-label={ariaLabel}
      aria-modal="true"
      onClick={(e) => {
        if (phase !== 'running') return;
        if (defenseMode) {
          e.preventDefault();
          pressDefense('dodge');
          return;
        }
        press();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
      }}
      onMouseDown={(e) => {
        if (e.button === 2 && defenseMode && phase === 'running') {
          e.preventDefault();
          pressDefense('parry');
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        background: splash
          ? 'rgba(4, 6, 12, 0.82)'
          : 'rgba(4, 6, 12, 0.72)',
        cursor: phase === 'running' ? 'pointer' : 'default',
        userSelect: 'none',
        padding: 16,
      }}
    >
      {splash ? (
        <div
          style={{
            position: 'relative',
            width: 'min(400px, 52vh)',
            aspectRatio: '2 / 3',
            borderRadius: 14,
            overflow: 'hidden',
            border: `1px solid ${accent}66`,
            background: '#050508',
            boxShadow: `0 0 0 1px ${accent}22, 0 18px 48px rgba(0,0,0,0.55)`,
          }}
        >
          <img
            src={SILHOUETTE_SRC[splash.sex]}
            alt={`${splash.sex === 'M' ? 'Male' : 'Female'} combat silhouette`}
            draggable={false}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'center bottom',
              pointerEvents: 'none',
            }}
          />
          <svg
            viewBox={`0 0 ${AIM_VIEWBOX.width} ${AIM_VIEWBOX.height}`}
            preserveAspectRatio="xMidYMax meet"
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            {regions.map(({ key, d }) => {
              const selected = key === splash.aim;
              return (
                <path
                  key={key}
                  d={d}
                  fill={selected ? `${accent}44` : 'transparent'}
                  stroke={selected ? accent : 'rgba(255,255,255,0.08)'}
                  strokeWidth={selected ? 2.4 : 1}
                />
              );
            })}
          </svg>
          {squares}
        </div>
      ) : (
        <div
          style={{
            position: 'relative',
            width: 220,
            height: 220,
          }}
        >
          {squares}
        </div>
      )}

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
          ? `${
              flash.verb
                ? defenseRhythmGradeLabel(flash.verb, flash.grade)
                : flash.zone
                  ? attackZoneFlashLabel(flash.zone)
                  : rhythmGradeLabel(flash.grade)
            }${flash.missKind !== 'none' ? ` (${flash.missKind})` : ''}`
          : shownHint}
      </div>

      {splash && !flash ? (
        <div style={{ fontSize: 12, opacity: 0.7, color: accent }}>
          Aim · {AIM_ZONE_LABELS[splash.aim]}
        </div>
      ) : null}

      <div style={{ fontSize: 11, opacity: 0.55, color: '#e5e7eb' }}>
        {defenseMode
          ? 'LMB / Space = dodge · RMB / P = parry · Esc cancel'
          : isBlockMode
            ? 'LMB / Space / Enter = block · Esc cancel'
            : `Esc to cancel · window ×${w.windowFactor.toFixed(2)} · competence ${w.competence.toFixed(2)}`}
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
  );
}
