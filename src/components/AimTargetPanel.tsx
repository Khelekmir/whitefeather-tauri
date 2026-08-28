import { useMemo, useState, type CSSProperties } from 'react';
import type { AttackTargetKey } from '../data/combat/attackTargets';
import { getAimRegionsForSex } from '../data/combat/aimRegionOverlays';
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

/** Distinct fills for the "show all regions" tuning overlay. */
const DEBUG_REGION_COLORS: Record<AttackTargetKey, string> = {
  head: '#fbbf24',
  chest: '#f87171',
  stomach: '#a78bfa',
  armLeft: '#38bdf8',
  armRight: '#22d3ee',
  groin: '#fb7185',
  legLeft: '#34d399',
  legRight: '#4ade80',
};

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

export interface AimTargetPanelProps {
  sex: Sex;
  aim: AttackTargetKey;
  onAimChange: (aim: AttackTargetKey) => void;
  /** Shown above the panel, e.g. "Targeting Kent (Fighter B)" */
  title?: string;
  accent?: string;
  /** Start with all region polygons visible (tuning aid). */
  defaultShowAllRegions?: boolean;
  style?: CSSProperties;
}
/**
 * Clickable silhouette: sex-specific art + matching SVG aim-zone overlay.
 * Region polygons live in `data/combat/aimRegionOverlays.ts` (F and M are independent).
 * Selects AttackTargetKey (not fine BodyPartId) — engine still rolls hitRatio.
 */
export function AimTargetPanel({
  sex,
  aim,
  onAimChange,
  title,
  accent = '#fbbf24',
  defaultShowAllRegions = false,
  style,
}: AimTargetPanelProps) {
  const [hovered, setHovered] = useState<AttackTargetKey | null>(null);
  const [showAllRegions, setShowAllRegions] = useState(defaultShowAllRegions);
  const src = SILHOUETTE_SRC[sex];
  const regions = useMemo(() => getAimRegionsForSex(sex), [sex]);

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

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          marginBottom: 8,
          fontSize: 11,
          opacity: 0.85,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <input
          type="checkbox"
          checked={showAllRegions}
          onChange={(e) => setShowAllRegions(e.target.checked)}
          style={{ margin: 0, cursor: 'pointer' }}
        />
        Show all regions
      </label>

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
          {regions.map(({ key, d }) => {
            const selected = aim === key;
            const isHovered = hovered === key;
            const debugColor = DEBUG_REGION_COLORS[key];

            let fill: string;
            let stroke: string;
            let strokeWidth: number;

            if (showAllRegions) {
              fill = withAlpha(debugColor, selected ? 0.55 : isHovered ? 0.42 : 0.28);
              stroke = selected || isHovered ? debugColor : withAlpha(debugColor, 0.85);
              strokeWidth = selected ? 2.4 : isHovered ? 1.8 : 1.3;
            } else {
              fill = selected
                ? `${accent}55`
                : isHovered
                  ? `${accent}33`
                  : 'transparent';
              stroke = selected || isHovered ? accent : 'rgba(255,255,255,0.12)';
              strokeWidth = selected ? 2.2 : isHovered ? 1.6 : 1;
            }

            return (
              <path
                key={key}
                d={d}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
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
          const chipAccent = showAllRegions ? DEBUG_REGION_COLORS[key] : accent;
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
                border: selected
                  ? `1px solid ${chipAccent}`
                  : '1px solid rgba(255,255,255,0.15)',
                background: selected ? withAlpha(chipAccent, 0.28) : 'rgba(255,255,255,0.04)',
                color: selected ? chipAccent : 'rgba(240,240,245,0.85)',
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
