import { useGameStore } from './store/gameStore';
import { useNavigate } from 'react-router-dom';
import type { Unit } from './types/game';
import { getDetailedCharacter } from './data/detailedPlaceholderCharacters';

const allegianceStyle: Record<Unit['allegiance'], { label: string; color: string; bg: string }> = {
  player: { label: 'Player', color: '#7dd3fc', bg: 'rgba(14, 165, 233, 0.15)' },
  ally: { label: 'Ally', color: '#86efac', bg: 'rgba(34, 197, 94, 0.15)' },
  enemy: { label: 'Enemy', color: '#fca5a5', bg: 'rgba(239, 68, 68, 0.15)' },
};

function StatBar({
  label,
  value,
  max = 100,
  color,
}: {
  label: string;
  value: number;
  max?: number;
  color: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ opacity: 0.85 }}>
          {value}{max !== 100 ? ` / ${max}` : '%'}
        </span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: 4,
            transition: 'width 0.25s ease',
          }}
        />
      </div>
    </div>
  );
}

function CharacterCard({ unit }: { unit: Unit }) {
  const navigate = useNavigate();
  const badge = allegianceStyle[unit.allegiance];
  const hasDetailed = !!getDetailedCharacter(unit.id);

  return (
    <div
      style={{
        border: `1px solid ${badge.color}44`,
        borderRadius: 10,
        padding: 18,
        background: 'linear-gradient(160deg, #1e1e2e 0%, #16161f 100%)',
        color: '#e8e8ef',
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '1.35rem', letterSpacing: 0.3 }}>{unit.name}</h3>
          <p style={{ margin: 0, opacity: 0.85, fontSize: 14 }}>
            {unit.class} · Lv. {unit.level}
            {unit.sex ? ` · ${unit.sex}` : ''}
            {typeof unit.age === 'number' ? ` · age ${unit.age}` : ''}
          </p>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            color: badge.color,
            background: badge.bg,
            border: `1px solid ${badge.color}55`,
            borderRadius: 999,
            padding: '4px 10px',
            whiteSpace: 'nowrap',
          }}
        >
          {badge.label}
        </span>
      </div>

      {unit.description && (
        <p style={{ margin: '12px 0 0', fontSize: 13, opacity: 0.8, lineHeight: 1.45 }}>
          {unit.description}
        </p>
      )}

      {(unit.personality || unit.temperament) && (
        <div style={{ marginTop: 10, fontSize: 13 }}>
          {unit.personality && (
            <div>
              <span style={{ opacity: 0.55 }}>Personality · </span>
              {unit.personality}
            </div>
          )}
          {unit.temperament && (
            <div style={{ marginTop: 2 }}>
              <span style={{ opacity: 0.55 }}>Temperament · </span>
              {unit.temperament}
            </div>
          )}
        </div>
      )}

      {unit.note && (
        <p
          style={{
            margin: '10px 0 0',
            fontSize: 12,
            opacity: 0.7,
            lineHeight: 1.4,
            fontStyle: 'italic',
          }}
        >
          {unit.note}
        </p>
      )}

      <div style={{ marginTop: 16 }}>
        <StatBar label="HP" value={unit.hp} max={unit.maxHp} color="#f87171" />
        <StatBar label="Relationship" value={unit.relationship} color="#c084fc" />
        <StatBar label="Arousal" value={unit.arousal} color="#fb7185" />
        <StatBar label="Stress" value={unit.stress} color="#fbbf24" />
      </div>

      <div style={{ marginTop: 12, fontSize: 13, opacity: 0.75 }}>
        Map pos: ({unit.position.x}, {unit.position.y})
      </div>

      {unit.traits?.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {unit.traits.map((trait) => (
            <span
              key={trait}
              style={{
                fontSize: 12,
                padding: '3px 8px',
                borderRadius: 6,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {trait}
            </span>
          ))}
        </div>
      )}

      {hasDetailed && (
        <button
          type="button"
          onClick={() => navigate(`/characters/detailed/${unit.id}`)}
          style={{
            marginTop: 14,
            width: '100%',
            padding: '8px 12px',
            background: '#4a1d96',
            color: '#fff',
            border: '1px solid #7c3aed',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          View detailed combat model →
        </button>
      )}
    </div>
  );
}

function CharacterList() {
  const { gameState, loadPlaceholderCharacters } = useGameStore();
  const navigate = useNavigate();
  const units = gameState.units || [];

  const byAllegiance = {
    player: units.filter((u) => u.allegiance === 'player').length,
    ally: units.filter((u) => u.allegiance === 'ally').length,
    enemy: units.filter((u) => u.allegiance === 'enemy').length,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '28px 32px 48px',
        fontFamily: 'system-ui, sans-serif',
        background: 'linear-gradient(180deg, #12081f 0%, #0a0a12 40%, #0a0a12 100%)',
        color: '#f0f0f5',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            padding: '8px 16px',
            background: '#2a1a4a',
            color: '#fff',
            border: '1px solid #5b3d9a',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          ← Back to Title Screen
        </button>
        <button
          type="button"
          onClick={() => navigate('/characters/detailed/unit_lyn')}
          style={{
            padding: '8px 16px',
            background: '#4a1d96',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Detailed combat model (Lyn)
        </button>
        {units.length === 0 && (
          <button
            type="button"
            onClick={loadPlaceholderCharacters}
            style={{
              padding: '8px 16px',
              background: '#4a1d96',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Load placeholder cast
          </button>
        )}
      </div>

      <h1 style={{ margin: '0 0 8px', fontSize: '2rem', fontWeight: 700 }}>Characters</h1>
      <p style={{ margin: '0 0 24px', opacity: 0.8 }}>
        {units.length} unit{units.length === 1 ? '' : 's'}
        {units.length > 0 && (
          <>
            {' '}
            · <span style={{ color: '#7dd3fc' }}>{byAllegiance.player} player</span>
            {' · '}
            <span style={{ color: '#86efac' }}>{byAllegiance.ally} ally</span>
            {' · '}
            <span style={{ color: '#fca5a5' }}>{byAllegiance.enemy} enemy</span>
          </>
        )}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 20,
        }}
      >
        {units.map((unit) => (
          <CharacterCard key={unit.id} unit={unit} />
        ))}
      </div>

      {units.length === 0 && (
        <p style={{ marginTop: 32, opacity: 0.7 }}>
          No characters in the current game state. Load the placeholder cast, or add a test unit from
          the Development Build page.
        </p>
      )}
    </div>
  );
}

export default CharacterList;
