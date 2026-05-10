import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';

function App() {
  const {
    gameState,
    saveGame,
    loadGame,
    updateUnit
  } = useGameStore();

  // Optional: Auto-load on startup
  useEffect(() => {
    loadGame();
  }, [loadGame]);

  const handleManualSave = async () => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `chapter_${gameState.chapter}_save_${timestamp}.json`;
    await useGameStore.getState().saveGameNamed(filename);
  };

  const handleListSaves = async () => {
    const saves = await useGameStore.getState().listSaves();
    console.log("Available saves:", saves);
    // TODO: Show in a modal later
  };

  const addTestUnit = () => {
    const newUnit = {
      id: `unit_${Date.now()}`,
      name: "Elara",
      class: "Swordmaster",
      level: 5,
      hp: 28,
      maxHp: 28,
      position: { x: 5, y: 5 },
      allegiance: "player" as const,
      relationship: 65,
      arousal: 20,
      stress: 15,
      traits: ["determined", "elegant"],
    };
    console.log("Adding test unit:", newUnit);

    // Add to store (you'll expand this logic later)
    useGameStore.setState((state) => ({
      gameState: {
        ...state.gameState,
        units: [...state.gameState.units, newUnit],
      },
    }));
  };

  return (
    <div style={{ padding: '30px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Whitefeather — Development Build</h1>
      <p>Chapter {gameState.chapter} • Turn {gameState.turn} • Phase: {gameState.phase}</p>

      <div style={{ margin: '20px 0', display: 'flex', gap: '12px' }}>
        <button onClick={saveGame} style={{ padding: '12px 20px', fontSize: '16px' }}>
          💾 Save Game (Autosave)
        </button>

        <button onClick={loadGame} style={{ padding: '12px 20px', fontSize: '16px' }}>
          📂 Load Game
        </button>

        <button onClick={addTestUnit} style={{ padding: '12px 20px', fontSize: '16px' }}>
          ➕ Add Test Unit (Elara)
        </button>
      </div>

      <div style={{ marginTop: '30px' }}>
        <h3>Current Units ({gameState.units.length})</h3>
        <pre style={{
          background: '#1e1e1e',
          color: '#ddd',
          padding: '15px',
          borderRadius: '6px',
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          {JSON.stringify(gameState.units, null, 2)}
        </pre>
      </div>

      <div style={{ marginTop: '30px', fontSize: '14px', color: '#888' }}>
        <strong>Tip:</strong> Click Save → then Load to test persistence.<br />
        Saves are stored in your AppData folder as <code>autosave.json</code>
      </div>
    </div>
  );
}

export default App;