import type { BrowserSignal } from "../types";

interface ProfileNexusProps {
  visible: boolean;
  signals: BrowserSignal[];
  profileId: string;
  completeness: number;
}

export function ProfileNexus({ visible, signals, profileId, completeness }: ProfileNexusProps) {
  if (!visible) return null;
  const preferred = ["browser", "timezone", "screen", "pointer", "canvas", "audioSignature"];
  const availableSignals = signals.filter((signal) => signal.available);
  const nodes = preferred
    .map((id) => availableSignals.find((signal) => signal.id === id))
    .filter((signal): signal is BrowserSignal => Boolean(signal));

  return (
    <section className="profile-nexus" aria-label="Local profile assembly">
      <div className="nexus-nodes" aria-hidden="true">
        {nodes.map((signal, index) => (
          <span className={`nexus-node nexus-node--${index + 1}`} key={signal.id}>{signal.label}</span>
        ))}
      </div>
      <div className="nexus-core">
        <span>SUBJECT</span>
        <strong>{profileId || "ASSEMBLING"}</strong>
      </div>
      <p>{completeness}% assembled</p>
    </section>
  );
}
