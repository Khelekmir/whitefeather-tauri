import { useMemo, useState, type CSSProperties } from 'react';
import type { AttackTargetKey } from '../data/combat/attackTargets';
import type { Sex } from '../types/characters';

const SILHOUETTE_SRC: Record<Sex, string> = {
  M: '/combat/silhouette_male_front.jpg',
  F: '/combat/silhouette_female_front.jpg',
};

/** Human-readable labels for aim zones (UI). */
export const AIM_ZONE_LABELS: Record<AttackTargetKey, string> = {
  head: 'Head',
  chest: 'Chest',
  stomach: 'Stomach',
  armLeft: 'Left arm',
  armRight: 'Right arm',
  groin: 'Groin',
  legLeft: 'Left leg',
  legRight: 'Right leg',
};

/**
 * Hit regions in viewBox 0 0 200 300 (matches 2:3 silhouette art).
 * Front-facing: screen-left = character's RIGHT, screen-right = character's LEFT.
 * Tuned to the combat_generics front silhouettes (figure centered, arms out).
 */
/**
 * Paint order = hit priority (later paths win overlaps).
 * Torso first, then legs, then arms, then head — so limb clicks aren't stolen by chest/stomach.
 */
const AIM_REGIONS: {
  key: AttackTargetKey;
  /** SVG path `d` in viewBox coords */
  d: string;
}[] = [
  {
    key: 'chest',
    // Shoulders through lower ribs (slightly inset so arms can win the outer edge)
    d: 'M 85 69 L 120 65 L 117 85 L 118 90 L 110 115 L 85 109 L 80 88 Z',
    // d: 'M 74 56 L 126 56 L 132 78 L 130 128 L 70 128 L 68 78 Z',
  },
  {
    key: 'stomach',
    d: 'M 82 110 L 110 115 L 115 135 L 89 135 L 70 125 Z',
  },
  {
    key: 'groin',
    d: 'M 70 125 L 88 135 L 112 135 L 90 152 L 85 148 Z',
    // d: 'M 80 125 L 120 172 L 118 214 L 82 214 Z',
  },
  {
    key: 'legRight',
    // Character's right leg (viewer's left)
    d: 'M 62 115 L 98 214 L 96 255 L 92 292 L 66 292 L 64 255 Z',
  },
  {
    key: 'legLeft',
    // Character's left leg (viewer's right)
    d: 'M 90 152 L 113 136 L 118 156 L 122 201 L 132 220 L 140 260 L 133 262 L 115 225 L 112 212 L 103 185 Z',
  },
  {
    key: 'armRight',
    // Character's right arm (viewer's left) — along the outer blue outline
    d: 'M 28 66 L 58 56 L 66 74 L 62 128 L 52 172 L 36 176 L 30 138 L 24 98 Z',
  },
  {
    key: 'armLeft',
    // Character's left arm (viewer's right)
    d: 'M 172 66 L 142 56 L 134 74 L 138 128 L 148 172 L 164 176 L 170 138 L 176 98 Z',
  },
  {
    key: 'head',
    d: 'M 100 8 C 84 8 74 20 74 36 C 74 50 82 60 92 64 L 108 64 C 118 60 126 50 126 36 C 126 20 116 8 100 8 Z',
  },
];

const AIM_ORDER: AttackTargetKey[] = [
  'head',
  'chest',
  'stomach',
  'armLeft',
  'armRight',
  'groin',
  'legLeft',
  'legRight',
];

export interface AimTargetPanelProps {
  sex: Sex;
  aim: AttackTargetKey;
  onAimChange: (aim: AttackTargetKey) => void;
  /** Shown above the panel, e.g. "Targeting Kent (Fighter B)" */
  title?: string;
  accent?: string;
  style?: CSSProperties;
}

/**
 * Clickable silhouette: shared male/female art + SVG aim-zone overlay.
 * Selects AttackTargetKey (not fine BodyPartId) — engine still rolls hitRatio.
 */
export function AimTargetPanel({
  sex,
  aim,
  onAimChange,
  title,
  accent = '#fbbf24',
  style,
}: AimTargetPanelProps) {
  const [hovered, setHovered] = useState<AttackTargetKey | null>(null);
  const src = SILHOUETTE_SRC[sex];

  const activeLabel = useMemo(
    () => AIM_ZONE_LABELS[hovered ?? aim],
    [hovered, aim]
  );

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 280,
        ...style,
      }}
    >
      {title ? (
        <div
          style={{
            fontSize: 12,
            opacity: 0.8,
            marginBottom: 6,
            textAlign: 'center',
            letterSpacing: 0.3,
          }}
        >
          {title}
        </div>
      ) : null}

      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '2 / 3',
          borderRadius: 12,
          overflow: 'hidden',
          border: `1px solid ${accent}55`,
          background: '#050508',
          boxShadow: `0 0 0 1px ${accent}22, 0 12px 28px rgba(0,0,0,0.45)`,
          userSelect: 'none',
        }}
      >
        <img
          src={src}
          alt={`${sex === 'M' ? 'Male' : 'Female'} combat silhouette`}
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
          viewBox="0 0 200 300"
          preserveAspectRatio="xMidYMax meet"
          role="img"
          aria-label="Select attack aim zone"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        >
          {AIM_REGIONS.map(({ key, d }) => {
            const selected = aim === key;
            const isHovered = hovered === key;
            return (
              <path
                key={key}
                d={d}
                fill={
                  selected
                    ? `${accent}55`
                    : isHovered
                      ? `${accent}33`
                      : 'transparent'
                }
                stroke={selected || isHovered ? accent : 'rgba(255,255,255,0.12)'}
                strokeWidth={selected ? 2.2 : isHovered ? 1.6 : 1}
                style={{ cursor: 'pointer', transition: 'fill 80ms ease, stroke 80ms ease' }}
                onMouseEnter={() => setHovered(key)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(key)}
                onBlur={() => setHovered(null)}
                onClick={() => onAimChange(key)}
                tabIndex={0}
                role="button"
                aria-label={`Aim ${AIM_ZONE_LABELS[key]}`}
                aria-pressed={selected}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onAimChange(key);
                  }
                }}
              />
            );
          })}
        </svg>
      </div>

      <div
        style={{
          marginTop: 8,
          textAlign: 'center',
          fontSize: 13,
          fontWeight: 600,
          color: accent,
          minHeight: 20,
        }}
      >
        Aim: {activeLabel}
      </div>

      {/* Keyboard / fallback list — keeps targeting usable without precise clicks */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          justifyContent: 'center',
          marginTop: 6,
        }}
      >
        {AIM_ORDER.map((key) => {
          const selected = aim === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onAimChange(key)}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              style={{
                fontSize: 10,
                padding: '3px 7px',
                borderRadius: 999,
                border: selected ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.15)',
                background: selected ? `${accent}33` : 'rgba(255,255,255,0.04)',
                color: selected ? accent : 'rgba(240,240,245,0.85)',
                cursor: 'pointer',
              }}
            >
              {AIM_ZONE_LABELS[key]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
