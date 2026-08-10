import type { BrowserSignal } from "../types";

interface SignalReadoutProps {
  signals: BrowserSignal[];
  heading: string;
}

export function SignalReadout({ signals, heading }: SignalReadoutProps) {
  if (!signals.length) return null;

  return (
    <aside className="signal-readout" aria-label={`${heading} browser signals`}>
      <p className="rail-heading">{heading}</p>
      <dl>
        {signals.slice(-8).map((signal) => (
          <div className="signal-row" key={signal.id}>
            <dt>{signal.label}</dt>
            <dd className={signal.available ? "" : "signal-withheld"}>{signal.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
