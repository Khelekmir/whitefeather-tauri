import { useEffect, useState } from 'react';
import { useGameStore } from './store/gameStore';
import { useNavigate } from 'react-router-dom';

function DevBuild() {
    const {
        gameState,
        saveGameAutosave,
        loadGame,
        deleteGame,
        saveGameManual,
        listSaves,
    } = useGameStore();

    const navigate = useNavigate();
    const [saveFiles, setSaveFiles] = useState<string[]>([]);

    useEffect(() => {
        loadGame();
        refreshSaves();
    }, [loadGame]);

    const refreshSaves = async () => {
        const files = await listSaves();
        setSaveFiles(files);
    };

    const handleChapterSave = async () => {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `chapter_${gameState.chapter}_${timestamp}.json`;
        await saveGameManual(filename);
        refreshSaves();
    };

    const handleLoadSave = async (filename: string) => {
        await loadGame(filename);
        refreshSaves();
    };

    const handleDeleteSave = async (filename: string) => {
        await deleteGame(filename);
        refreshSaves();
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

        useGameStore.setState((state) => ({
            gameState: {
                ...state.gameState,
                units: [...state.gameState.units, newUnit],
            },
        }));
    };

    return (
        <div style={{ padding: '30px', fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ marginBottom: '20px' }}>
                <button onClick={() => navigate('/')} style={{ padding: '8px 16px' }}>
                    ← Back to Title Screen
                </button>
            </div>

            <h1>Whitefeather — Development Build</h1>
            <p>Chapter {gameState.chapter} • Turn {gameState.turn} • Phase: {gameState.phase}</p>
            <div style={{ margin: '20px 0', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button onClick={saveGameAutosave}>💾 Autosave</button>
                <button onClick={handleChapterSave}>📖 Chapter Save</button>
                <button onClick={addTestUnit}>➕ Add Test Unit</button>
                <button onClick={refreshSaves}>🔄 Refresh List</button>
            </div>

            {/* Save Files List */}
            <div>
                <h3>Available Saves ({saveFiles.length})</h3>
                <ul style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {saveFiles.map(file => (
                        <li key={file} style={{ margin: '6px 0' }}>
                            <button
                                onClick={() => handleLoadSave(file)}
                                style={{ marginRight: '12px' }}
                            >
                                📂 Load
                            </button>
                            <button
                                onClick={() => handleDeleteSave(file)}
                                style={{ marginRight: '12px' }}
                            >
                                🗑️ Delete
                            </button>
                            <code>{file}</code>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Current State */}
            <div style={{ marginTop: '30px' }}>
                <h3>Current Game State</h3>
                <pre style={{ background: '#1e1e1e', color: '#ddd', padding: '15px', borderRadius: '6px' }}>
                    {JSON.stringify(gameState, null, 2)}
                </pre>
            </div>
        </div>

    );
}

export default DevBuild;