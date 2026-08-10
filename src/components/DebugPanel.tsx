import { useState } from "react";
import { SCENE_ORDER } from "../content/narrative";
import type { GameSnapshot, SceneId } from "../types";

interface DebugPanelProps {
  scene: SceneId;
  snapshot: GameSnapshot;
  onJump: (scene: SceneId) => void;
  onReset: () => void;
  onSpeed: (speed: number) => void;
  onSimulateLocation: (result: "granted" | "denied" | "unavailable") => void;
}

export function DebugPanel({ scene, snapshot, onJump, onReset, onSpeed, onSimulateLocation }: DebugPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <aside className={`debug-panel${open ? " debug-panel--open" : ""}`} aria-label="Development debug controls">
      <button type="button" onClick={() => setOpen((value) => !value)}>DEBUG {open ? "−" : "+"}</button>
      {open && (
        <div>
          <label>
            Scene
            <select value={scene} onChange={(event) => onJump(event.target.value as SceneId)}>
              {SCENE_ORDER.map((id) => <option value={id} key={id}>{id}</option>)}
            </select>
          </label>
          <label>
            Speed
            <select defaultValue="1" onChange={(event) => onSpeed(Number(event.target.value))}>
              <option value="1">1×</option>
              <option value="5">5×</option>
              <option value="25">25×</option>
              <option value="100">100×</option>
            </select>
          </label>
          <div className="debug-actions">
            <button onClick={onReset} type="button">RESET</button>
            <button onClick={() => onSimulateLocation("granted")} type="button">GEO +</button>
            <button onClick={() => onSimulateLocation("denied")} type="button">GEO −</button>
            <button onClick={() => onSimulateLocation("unavailable")} type="button">GEO ∅</button>
          </div>
          <pre>{JSON.stringify(snapshot, null, 2)}</pre>
        </div>
      )}
    </aside>
  );
}
