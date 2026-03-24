import { useEffect, useState } from "react";
import { useAtlasStore } from "@/store/atlasStore";

export function Tooltip() {
  const hoveredPolygonId = useAtlasStore((s) => s.hoveredPolygonId);
  const polygonData = useAtlasStore((s) => s.polygonData);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  if (!hoveredPolygonId || !polygonData) return null;

  const struct = polygonData.structures.find((s) => s.id === hoveredPolygonId);
  if (!struct) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: pos.x + 16,
        top: pos.y - 10,
        background: "rgba(0,0,0,0.85)",
        color: "#fff",
        padding: "6px 12px",
        borderRadius: 6,
        fontSize: 13,
        pointerEvents: "none",
        zIndex: 1000,
        maxWidth: 260,
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ fontWeight: 700 }}>{struct.nameEn}</div>
      {struct.nameLat && (
        <div style={{ fontSize: 11, color: "#aaa", fontStyle: "italic" }}>{struct.nameLat}</div>
      )}
    </div>
  );
}
