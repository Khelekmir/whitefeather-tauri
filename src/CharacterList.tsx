import { useGameStore } from './store/gameStore';
import { useNavigate } from 'react-router-dom';

function CharacterList() {
  const { gameState } = useGameStore();
  const navigate = useNavigate();

  const units = gameState.units || [];

  return (
    <div style={{ padding: '30px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => navigate('/')} style={{ padding: '8px 16px' }}>
          ← Back to Title Screen
        </button>
      </div>

      <h1>Characters</h1>
      <p>Total Units: {units.length}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {units.map(unit => (
          <div key={unit.id} style={{
            border: '1px solid #555',
            borderRadius: '8px',
            padding: '16px',
            background: '#1e1e2e'
          }}>
            <h3>{unit.name}</h3>
            <p><strong>Class:</strong> {unit.class} • Level {unit.level}</p>
            <p>❤️ HP: {unit.hp}/{unit.maxHp}</p>
            <p>❤️‍🔥 Relationship: {unit.relationship}%</p>
            <p>🔥 Arousal: {unit.arousal}%</p>
            <p>😟 Stress: {unit.stress}%</p>
            <p><strong>Traits:</strong> {unit.traits?.join(', ') || 'None'}</p>
          </div>
        ))}
      </div>

      {units.length === 0 && <p>No characters yet. Add some in Dev Build!</p>}
    </div>
  );
}

export default CharacterList;