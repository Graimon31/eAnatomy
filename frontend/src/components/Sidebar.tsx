import { useAtlasStore } from "@/store/atlasStore";

export function Sidebar() {
  const polygonData = useAtlasStore((s) => s.polygonData);
  const selectedStructureId = useAtlasStore((s) => s.selectedStructureId);
  const hoveredPolygonId = useAtlasStore((s) => s.hoveredPolygonId);
  const sliceIndex = useAtlasStore((s) => s.sliceIndex);
  const slices = useAtlasStore((s) => s.slices);
  const module_ = useAtlasStore((s) => s.module);
  const showLabels = useAtlasStore((s) => s.showLabels);

  if (!polygonData || !module_) return null;

  // Structures visible on current slice
  const currentPolys = polygonData.slices[String(sliceIndex)] ?? [];
  const visibleIds = new Set(currentPolys.map((p) => p.structureId));
  const visibleStructures = polygonData.structures.filter((s) => visibleIds.has(s.id));

  const selected = polygonData.structures.find((s) => s.id === selectedStructureId);

  return (
    <aside style={{
      width: 300, minWidth: 300, background: "#16213e", color: "#eee",
      display: "flex", flexDirection: "column", overflow: "hidden",
      borderLeft: "1px solid #0f3460",
    }}>
      {/* Module header */}
      <div style={{ padding: "16px", borderBottom: "1px solid #0f3460" }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>{module_.title}</h2>
        <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
          {module_.modality} · {module_.plane} · {slices.length} slices
        </div>
      </div>

      {/* Slice slider */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #0f3460" }}>
        <label style={{ fontSize: 12, color: "#aaa" }}>
          Slice {sliceIndex + 1} / {slices.length}
        </label>
        <input
          type="range"
          min={0}
          max={slices.length - 1}
          value={sliceIndex}
          onChange={(e) => useAtlasStore.getState().setSliceIndex(Number(e.target.value))}
          style={{ width: "100%", marginTop: 4 }}
        />
      </div>

      {/* Controls */}
      <div style={{ padding: "8px 16px", borderBottom: "1px solid #0f3460", display: "flex", gap: 8 }}>
        <button onClick={() => useAtlasStore.getState().resetView()}
          style={btnStyle}>Reset View</button>
        <button onClick={() => useAtlasStore.getState().toggleLabels()}
          style={btnStyle}>{showLabels ? "Hide" : "Show"} Labels</button>
      </div>

      {/* Selected structure detail */}
      {selected && (
        <div style={{ padding: 16, borderBottom: "1px solid #0f3460", background: "#1a1a3e" }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{selected.nameEn}</div>
          {selected.nameLat && (
            <div style={{ fontSize: 12, color: "#aaa", fontStyle: "italic" }}>{selected.nameLat}</div>
          )}
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: selected.color, display: "inline-block" }} />
            <span style={{ fontSize: 11, color: "#888" }}>ID: {selected.id}</span>
          </div>
        </div>
      )}

      {/* Structure list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        <div style={{ padding: "4px 16px", fontSize: 11, color: "#666", textTransform: "uppercase" }}>
          Structures on this slice ({visibleStructures.length})
        </div>
        {visibleStructures.map((s) => (
          <div
            key={s.id}
            onClick={() => useAtlasStore.getState().setSelectedStructureId(
              selectedStructureId === s.id ? null : s.id
            )}
            onMouseEnter={() => useAtlasStore.getState().setHoveredPolygonId(s.id)}
            onMouseLeave={() => useAtlasStore.getState().setHoveredPolygonId(null)}
            style={{
              padding: "6px 16px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background:
                s.id === selectedStructureId ? "#0f3460" :
                s.id === hoveredPolygonId ? "#1a1a3e" : "transparent",
              transition: "background 0.1s",
            }}
          >
            <span style={{
              width: 10, height: 10, borderRadius: 2,
              background: s.color, flexShrink: 0,
            }} />
            <span style={{ fontSize: 13 }}>{s.nameEn}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

const btnStyle: React.CSSProperties = {
  background: "#0f3460", border: "none", color: "#eee",
  padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12,
};
