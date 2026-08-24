import { useEffect, useState } from 'react';
import { useGameStore } from './store/gameStore';
import { useNavigate } from 'react-router-dom';

function DevBuild() {
  const {
    gameState,
    lastSaveMessage,
    saveGameAutosave,
    loadGame,
    deleteGame,
    saveGameManual,
    listSaves,
    loadPlaceholderCharacters,
  } = useGameStore();

  const navigate = useNavigate();
  const [saveFiles, setSaveFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const refreshSaves = async () => {
    const files = await listSaves();
    setSaveFiles(files);
  };

  useEffect(() => {
    // Try autosave; list files either way
    (async () => {
      await loadGame();
      await refreshSaves();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only seed
  }, []);

  const handleChapterSave = async () => {
    setBusy(true);
    try {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `chapter_${gameState.chapter}_${timestamp}.json`;
      const ok = await saveGameManual(filename);
      if (ok) await refreshSaves();
    } finally {
      setBusy(false);
    }
  };

  const handleAutosave = async () => {
    setBusy(true);
    try {
      const ok = await saveGameAutosave();
      if (ok) await refreshSaves();
    } finally {
      setBusy(false);
    }
  };

  const handleLoadSave = async (filename: string) => {
    setBusy(true);
    try {
      await loadGame(filename);
      await refreshSaves();
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSave = async (filename: string) => {
    setBusy(true);
    try {
      const ok = await deleteGame(filename);
      if (ok) await refreshSaves();
    } finally {
      setBusy(false);
    }
  };

  const addTestUnit = () => {
    const newUnit = {
      id: `unit_${Date.now()}`,
      name: 'Test Recruit',
      sex: 'F' as const,
      age: 20,
      description: 'A temporary unit added from Dev Build.',
      personality: 'Eager Novice',
      temperament: 'Sanguine',
      note: 'Dev-only test unit; safe to delete from roster.',
      class: 'Soldier',
      level: 1,
      hp: 20,
      maxHp: 20,
      position: { x: 5, y: 5 },
      allegiance: 'player' as const,
      relationship: 50,
      arousal: 0,
      stress: 20,
      traits: ['Eager Novice', 'Sanguine'],
    };

    useGameStore.setState((state) => ({
      gameState: {
        ...state.gameState,
        units: [...state.gameState.units, newUnit],
      },
      lastSaveMessage: `Added test unit (roster: ${state.gameState.units.length + 1})`,
    }));
  };

  const messageLooksLikeError =
    !!lastSaveMessage &&
    /fail|error|not found|skipped/i.test(lastSaveMessage);

  return (
    <div style={{ padding: '30px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => navigate('/')} style={{ padding: '8px 16px' }}>
          ← Back to Title Screen
        </button>
        <button type="button" onClick={() => navigate('/characters')} style={{ padding: '8px 16px' }}>
          View Characters →
        </button>
      </div>

      <h1>Whitefeather — Development Build</h1>
      <p>
        Chapter {gameState.chapter} • Turn {gameState.turn} • Phase: {gameState.phase}
        {' '}• Units: {gameState.units.length}
      </p>

      {lastSaveMessage && (
        <p
          style={{
            padding: '10px 14px',
            borderRadius: 6,
            background: messageLooksLikeError ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
            border: `1px solid ${messageLooksLikeError ? '#f87171' : '#4ade80'}`,
            color: messageLooksLikeError ? '#fecaca' : '#bbf7d0',
          }}
        >
          {lastSaveMessage}
        </p>
      )}

      <div style={{ margin: '20px 0', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button type="button" onClick={handleAutosave} disabled={busy}>
          💾 Autosave
        </button>
        <button type="button" onClick={handleChapterSave} disabled={busy}>
          📖 Chapter Save
        </button>
        <button type="button" onClick={addTestUnit} disabled={busy}>
          ➕ Add Test Unit
        </button>
        <button type="button" onClick={loadPlaceholderCharacters} disabled={busy}>
          🎭 Reset Placeholder Cast
        </button>
        <button type="button" onClick={refreshSaves} disabled={busy}>
          🔄 Refresh List
        </button>
      </div>

      <div>
        <h3>Available Saves ({saveFiles.length})</h3>
        {saveFiles.length === 0 && (
          <p style={{ opacity: 0.7 }}>No save files yet. Use Chapter Save or Autosave.</p>
        )}
        <ul style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {saveFiles.map((file) => (
            <li key={file} style={{ margin: '6px 0' }}>
              <button
                type="button"
                onClick={() => handleLoadSave(file)}
                disabled={busy}
                style={{ marginRight: '12px' }}
              >
                📂 Load
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSave(file)}
                disabled={busy}
                style={{ marginRight: '12px' }}
              >
                🗑️ Delete
              </button>
              <code>{file}</code>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: '30px' }}>
        <h3>Current Game State</h3>
        <pre
          style={{
            background: '#1e1e1e',
            color: '#ddd',
            padding: '15px',
            borderRadius: '6px',
            maxHeight: 480,
            overflow: 'auto',
          }}
        >
          {JSON.stringify(gameState, null, 2)}
        </pre>
      </div>
    </div>
  );
}

export default DevBuild;
