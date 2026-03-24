import React, { useEffect, useState } from 'react';
import { useAtlasStore } from '../store/atlasStore';
import CanvasRenderer from './CanvasRenderer';
import Toolbar from './Toolbar';
import InfoPanel from './InfoPanel';
import type { AtlasModule, SliceInfo } from '../types/atlas';

const API = '/api';

const App: React.FC = () => {
  const setModule = useAtlasStore((s) => s.setModule);
  const module = useAtlasStore((s) => s.module);
  const [modules, setModules] = useState<AtlasModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch available modules
  useEffect(() => {
    fetch(`${API}/modules`)
      .then((r) => r.json())
      .then((data) => {
        setModules(data);
        // Auto-select first module
        if (data.length > 0) loadModule(data[0]);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const loadModule = async (mod: AtlasModule) => {
    try {
      const res = await fetch(`${API}/slices/${mod.id}`);
      const data = await res.json() as { slices: SliceInfo[] };
      const paths = new Array(mod.total_slices).fill('');
      for (const s of data.slices) {
        paths[s.slice_index] = s.image_path;
      }
      setModule(mod, paths);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p>Loading atlas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#FF6B6B' }}>Error: {error}</p>
        <p style={{ color: '#888', fontSize: 13 }}>
          Make sure the backend is running on port 4000
        </p>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <Toolbar />
      <div style={styles.body}>
        {/* Module selector (when multiple modules exist) */}
        {modules.length > 1 && (
          <div style={styles.modulePicker}>
            {modules.map((m) => (
              <button
                key={m.id}
                style={{
                  ...styles.moduleBtn,
                  background: m.id === module?.id ? '#4ECDC4' : '#333',
                  color: m.id === module?.id ? '#000' : '#ddd',
                }}
                onClick={() => loadModule(m)}
              >
                {m.title}
              </button>
            ))}
          </div>
        )}
        <div style={styles.viewport}>
          <CanvasRenderer />
        </div>
        <InfoPanel />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  viewport: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: 16,
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #333',
    borderTop: '3px solid #4ECDC4',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  modulePicker: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 8,
    background: '#0f1629',
    overflowY: 'auto',
    maxWidth: 200,
  },
  moduleBtn: {
    padding: '6px 12px',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    textAlign: 'left' as const,
  },
};

export default App;
