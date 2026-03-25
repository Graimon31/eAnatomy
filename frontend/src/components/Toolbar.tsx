import React from 'react';
import { useAtlasStore } from '../store/atlasStore';

const Toolbar: React.FC = () => {
  const module = useAtlasStore((s) => s.module);
  const sliceIndex = useAtlasStore((s) => s.sliceIndex);
  const zoom = useAtlasStore((s) => s.zoom);
  const showLabels = useAtlasStore((s) => s.showLabels);
  const polygonOpacity = useAtlasStore((s) => s.polygonOpacity);
  const setSliceIndex = useAtlasStore((s) => s.setSliceIndex);
  const resetView = useAtlasStore((s) => s.resetView);
  const toggleLabels = useAtlasStore((s) => s.toggleLabels);
  const setPolygonOpacity = useAtlasStore((s) => s.setPolygonOpacity);
  const setZoom = useAtlasStore((s) => s.setZoom);

  if (!module) return null;

  return (
    <div style={styles.toolbar}>
      <div style={styles.section}>
        <span style={styles.title}>{module.title}</span>
        <span style={styles.badge}>{module.modality} — {module.plane}</span>
      </div>

      <div style={styles.section}>
        <label style={styles.label}>Slice</label>
        <input
          type="range"
          min={0}
          max={module.total_slices - 1}
          value={sliceIndex}
          onChange={(e) => setSliceIndex(parseInt(e.target.value, 10))}
          style={styles.slider}
        />
        <span style={styles.value}>
          {sliceIndex + 1} / {module.total_slices}
        </span>
      </div>

      <div style={styles.section}>
        <label style={styles.label}>Zoom</label>
        <span style={styles.value}>{zoom.toFixed(1)}x</span>
        <button style={styles.btn} onClick={resetView}>Reset</button>
      </div>

      <div style={styles.section}>
        <label style={styles.label}>Opacity</label>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(polygonOpacity * 100)}
          onChange={(e) => setPolygonOpacity(parseInt(e.target.value, 10) / 100)}
          style={{ ...styles.slider, width: 80 }}
        />
      </div>

      <div style={styles.section}>
        <button
          style={{ ...styles.btn, background: showLabels ? '#4ECDC4' : '#555' }}
          onClick={toggleLabels}
        >
          Labels {showLabels ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '8px 16px',
    background: '#16213e',
    borderBottom: '1px solid #333',
    flexWrap: 'wrap',
    zIndex: 10,
  },
  section: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontWeight: 700,
    fontSize: 15,
    color: '#fff',
  },
  badge: {
    fontSize: 11,
    padding: '2px 8px',
    background: '#4ECDC4',
    color: '#000',
    borderRadius: 4,
    fontWeight: 600,
  },
  label: {
    fontSize: 12,
    color: '#aaa',
  },
  value: {
    fontSize: 13,
    color: '#fff',
    minWidth: 50,
    fontVariantNumeric: 'tabular-nums',
  },
  slider: {
    width: 120,
    accentColor: '#4ECDC4',
  },
  btn: {
    padding: '4px 12px',
    border: 'none',
    borderRadius: 4,
    background: '#333',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
};

export default Toolbar;
