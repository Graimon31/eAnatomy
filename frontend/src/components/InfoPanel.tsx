import React from 'react';
import { useAtlasStore } from '../store/atlasStore';

const InfoPanel: React.FC = () => {
  const hoveredLabel = useAtlasStore((s) => s.hoveredLabel);
  const hoveredPolygonId = useAtlasStore((s) => s.hoveredPolygonId);
  const selectedPolygonId = useAtlasStore((s) => s.selectedPolygonId);
  const sliceIndex = useAtlasStore((s) => s.sliceIndex);
  const polygonCache = useAtlasStore((s) => s.polygonCache);

  const polygons = polygonCache.get(sliceIndex) || [];
  const selected = polygons.find((p) => p.id === selectedPolygonId);
  const hovered = polygons.find((p) => p.id === hoveredPolygonId);
  const display = selected || hovered;

  return (
    <div style={styles.panel}>
      <h3 style={styles.heading}>Structures</h3>
      {display ? (
        <div style={styles.info}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                background: display.color,
              }}
            />
            <span style={styles.structName}>{display.labelEn}</span>
          </div>
          {display.labelLa && (
            <div style={styles.latin}>{display.labelLa}</div>
          )}
          <div style={styles.code}>{display.structureCode}</div>
        </div>
      ) : (
        <p style={styles.hint}>
          Hover over a structure to see its name.
          <br />
          Click to select.
        </p>
      )}

      <h4 style={{ ...styles.heading, fontSize: 12, marginTop: 16 }}>
        Visible ({polygons.length})
      </h4>
      <div style={styles.list}>
        {polygons.map((p) => (
          <div
            key={p.id}
            style={{
              ...styles.listItem,
              background:
                p.id === selectedPolygonId
                  ? 'rgba(78,205,196,0.2)'
                  : p.id === hoveredPolygonId
                  ? 'rgba(255,255,255,0.05)'
                  : 'transparent',
            }}
            onMouseEnter={() =>
              useAtlasStore.getState().setHoveredPolygon(p.id, p.labelEn)
            }
            onMouseLeave={() =>
              useAtlasStore.getState().setHoveredPolygon(null, null)
            }
            onClick={() =>
              useAtlasStore.getState().setSelectedPolygon(p.id)
            }
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 1,
                background: p.color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 12 }}>{p.labelEn}</span>
          </div>
        ))}
      </div>

      <div style={styles.shortcuts}>
        <h4 style={{ ...styles.heading, fontSize: 11, marginTop: 16 }}>
          Shortcuts
        </h4>
        <div style={styles.shortcut}>Scroll — Change slice</div>
        <div style={styles.shortcut}>Ctrl+Scroll — Zoom</div>
        <div style={styles.shortcut}>Drag — Pan</div>
        <div style={styles.shortcut}>Click — Select structure</div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 260,
    background: '#16213e',
    borderLeft: '1px solid #333',
    padding: 16,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  heading: {
    fontSize: 14,
    fontWeight: 700,
    color: '#4ECDC4',
    marginBottom: 8,
  },
  info: {
    padding: 12,
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 6,
  },
  structName: {
    fontSize: 15,
    fontWeight: 600,
  },
  latin: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#aaa',
    marginTop: 4,
  },
  code: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  hint: {
    fontSize: 13,
    color: '#888',
    lineHeight: 1.6,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    maxHeight: 300,
    overflowY: 'auto',
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 8px',
    borderRadius: 4,
    cursor: 'pointer',
    color: '#ddd',
  },
  shortcuts: {
    marginTop: 'auto',
  },
  shortcut: {
    fontSize: 11,
    color: '#666',
    padding: '2px 0',
  },
};

export default InfoPanel;
