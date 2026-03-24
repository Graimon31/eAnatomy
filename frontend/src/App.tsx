import { CanvasRenderer } from "@/components/CanvasRenderer";
import { Sidebar } from "@/components/Sidebar";
import { Tooltip } from "@/components/Tooltip";
import { useModuleLoader } from "@/hooks/useModuleLoader";

// For MVP, hardcode the demo module slug.
// In production, this would come from a router param.
const MODULE_SLUG = "brain-mri-axial";

export default function App() {
  useModuleLoader(MODULE_SLUG);

  return (
    <div style={{
      display: "flex",
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      background: "#0a0a1a",
    }}>
      {/* Main canvas area */}
      <div style={{ flex: 1, position: "relative" }}>
        <CanvasRenderer />
      </div>

      {/* Right sidebar */}
      <Sidebar />

      {/* Floating tooltip */}
      <Tooltip />
    </div>
  );
}
