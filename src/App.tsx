import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import DevBuild from './DevBuild';           // We'll create this
import CharacterList from './CharacterList'; // We'll create this
import { useGameStore } from './store/gameStore';

function TitleScreen() {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(#1a0033, #000000)',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '4rem', margin: '0 0 2rem' }}>WHITEFEATHER</h1>
      <p style={{ fontSize: '1.4rem', marginBottom: '3rem', opacity: 0.9 }}>
        A Tale of Strategy, Honor, and Desire
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '280px' }}>
        <Link to="/dev" style={menuButtonStyle}>
          Development Build
        </Link>
        <Link to="/characters" style={menuButtonStyle}>
          Character List
        </Link>
        {/* Future options will go here */}
      </div>

      <p style={{ marginTop: '4rem', opacity: 0.6, fontSize: '0.9rem' }}>
        Whitefeather Tauri • Early Development
      </p>
    </div>
  );
}

// Simple reusable button style
const menuButtonStyle = {
  padding: '14px 32px',
  fontSize: '1.2rem',
  background: '#4a1d96',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  textDecoration: 'none',
  textAlign: 'center' as const,
  transition: 'all 0.2s',
};

function App() {
  const loadGame = useGameStore(state => state.loadGame);

  // Auto-load latest game state on app start
  useEffect(() => {
    loadGame();
  }, [loadGame]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<TitleScreen />} />
        <Route path="/dev" element={<DevBuild />} />
        <Route path="/characters" element={<CharacterList />} />
      </Routes>
    </Router>
  );
}

export default App;