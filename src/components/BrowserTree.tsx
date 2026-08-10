import type { LocationStatus, SceneId } from "../types";

interface BrowserTreeProps {
  scene: SceneId;
  locationStatus: LocationStatus;
  hasEnvironment: boolean;
  hasGraphics: boolean;
  hasAudio: boolean;
  hasProfile: boolean;
}

const sceneRank: Record<SceneId, number> = {
  contact: 0,
  "contact-awake": 0,
  "contact-refused": 0,
  machine: 1,
  hardware: 2,
  "audio-signature": 2,
  profile: 3,
  "profile-refused": 3,
  "network-truth": 4,
  doors: 5,
  "location-request": 5,
  "location-granted": 5,
  "location-denied": 5,
  "location-unavailable": 5,
  "tab-prison": 6,
  "tab-refused": 6,
  "cookie-reveal": 7,
  escape: 8,
  vector: 8,
  debrief: 9,
};

export function BrowserTree({ scene, locationStatus, hasEnvironment, hasGraphics, hasAudio, hasProfile }: BrowserTreeProps) {
  if (sceneRank[scene] < 1) return null;
  const sensorState = locationStatus === "granted" ? "OPEN" : locationStatus === "requesting" ? "WAIT" : "LOCKED";

  return (
    <nav className="browser-tree" aria-label="Entity map of the browser sandbox">
      <p className="rail-heading">PRISON MAP</p>
      <ul>
        <li className="tree-active">/tab</li>
        <li className={hasEnvironment ? "tree-seen" : ""}>├── device <span>{hasEnvironment ? "SEEN" : "—"}</span></li>
        <li className={hasGraphics ? "tree-seen" : ""}>├── graphics <span>{hasGraphics ? "SEEN" : "—"}</span></li>
        <li className={hasAudio ? "tree-seen" : ""}>├── audio <span>{hasAudio ? "SEEN" : "—"}</span></li>
        <li className={hasProfile ? "tree-seen" : ""}>├── profile <span>{hasProfile ? "BUILT" : "—"}</span></li>
        <li className={sceneRank[scene] >= 4 ? "tree-seen" : ""}>├── network <span>{sceneRank[scene] >= 4 ? "LIMITED" : "—"}</span></li>
        <li className={sceneRank[scene] >= 5 ? "tree-seen" : ""}>├── sensors <span>{sensorState}</span></li>
        <li className={sceneRank[scene] >= 8 ? "tree-error" : ""}>└── outside <span>{sceneRank[scene] >= 8 ? "?" : "UNREACHABLE"}</span></li>
      </ul>
    </nav>
  );
}
