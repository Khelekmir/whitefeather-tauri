import type { CSSProperties } from 'react';
import type { DefenseVerb } from '../utils/combat/defenseRhythm';

export interface DefenseVerbPickerProps {
  canParry: boolean;
  parryBlockedReason?: string;
  onPick: (verb: DefenseVerb) => void;
  onCancel?: () => void;
  accent?: string;
  title?: string;
}

const btnBase: CSSProperties = {
  padding: '14px 28px',
  fontSize: 16,
  fontWeight: 650,
  borderRadius: 10,
  cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.25)',
  color: '#f8fafc',
  minWidth: 140,
};

/**
 * Choose Dodge or Parry before the defense timing QTE.
 */
export function DefenseVerbPicker({
  canParry,
  parryBlockedReason = 'No usable weapon to parry',
  onPick,
  onCancel,
  accent = '#86efac',
  title = 'Incoming attack — choose defense',
}: DefenseVerbPickerProps) {
  return (
    <div
      role="dialog"
      aria-label="Choose defense"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 85,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(4, 6, 12, 0.78)',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
          padding: 28,
          borderRadius: 16,
          border: `1px solid ${accent}55`,
          background:
            'linear-gradient(180deg, rgba(20,40,28,0.95) 0%, rgba(10,14,12,0.98) 100%)',
          boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
          maxWidth: 420,
        }}
      >
        <div
          style={{
            fontSize: 13,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: accent,
            opacity: 0.9,
          }}
        >
          Player defense
        </div>
        <h2 style={{ margin: 0, fontSize: '1.35rem', textAlign: 'center' }}>
          {title}
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            opacity: 0.7,
            textAlign: 'center',
            lineHeight: 1.45,
          }}
        >
          Timing QTE starts after you pick. Clean timing costs less stamina.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          <button
            type="button"
            style={{
              ...btnBase,
              background: 'rgba(56,189,248,0.25)',
              borderColor: 'rgba(125,211,252,0.7)',
            }}
            onClick={() => onPick('dodge')}
          >
            Dodge
          </button>
          <button
            type="button"
            disabled={!canParry}
            title={canParry ? 'Parry with main-hand' : parryBlockedReason}
            style={{
              ...btnBase,
              background: canParry
                ? 'rgba(167,139,250,0.28)'
                : 'rgba(80,80,90,0.35)',
              borderColor: canParry
                ? 'rgba(196,181,253,0.75)'
                : 'rgba(255,255,255,0.15)',
              opacity: canParry ? 1 : 0.45,
              cursor: canParry ? 'pointer' : 'not-allowed',
            }}
            onClick={() => canParry && onPick('parry')}
          >
            Parry
          </button>
        </div>
        {!canParry ? (
          <p style={{ margin: 0, fontSize: 12, color: '#fcd34d' }}>
            {parryBlockedReason}
          </p>
        ) : null}
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            style={{
              marginTop: 4,
              padding: '6px 12px',
              fontSize: 12,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 6,
              color: '#cbd5e1',
              cursor: 'pointer',
            }}
          >
            Take the hit (skip defense)
          </button>
        ) : null}
      </div>
    </div>
  );
}
