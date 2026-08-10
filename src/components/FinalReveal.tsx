import type { BrowserSignal, LocationStatus } from "../types";

interface FinalRevealProps {
  signals: BrowserSignal[];
  locationStatus: LocationStatus;
  onRestart: () => void;
}

const notObserved = [
  ["Your name", "Not known"],
  ["Passwords", "Not accessible"],
  ["Browsing history contents", "Not accessed; only this tab's entry count was observed"],
  ["Personal files", "Not accessed"],
  ["Contacts or messages", "Not accessible"],
  ["Other tab contents", "Not accessible"],
  ["Camera", "Never requested"],
  ["Microphone", "Never requested"],
  ["IP-derived city", "Deliberately not queried"],
];

function locationLabel(status: LocationStatus) {
  switch (status) {
    case "granted": return "Granted; coordinates remained in this tab";
    case "denied": return "Denied by the browser";
    case "refused": return "Never requested";
    case "timed-out": return "Requested; no coordinates returned";
    case "unavailable": return "Unavailable in this browser context";
    default: return "Never requested";
  }
}

export function FinalReveal({ signals, locationStatus, onRestart }: FinalRevealProps) {
  return (
    <main className="debrief">
      <header className="debrief-hero">
        <p className="debrief-kicker">UNKNOWN / DEBRIEF</p>
        <h1>THE ENTITY WASN'T REAL.</h1>
        <h2>THE DATA WAS.</h2>
        <p>
          The eyes, dialogue, decisions, and escape were a scripted state machine. Every browser and device fact shown during
          the experience came from an API available to this page. No language model was involved.
        </p>
      </header>

      <section className="debrief-section debrief-explainer">
        <p className="section-index">WHAT HAPPENED</p>
        <h3>Small observations can become a recognizable pattern.</h3>
        <p>
          A browser fingerprint is not automatically a legal identity, an exact person, or a guarantee of uniqueness.
          It is a combination of characteristics that may help distinguish one browser from others or correlate visits.
          Browsers can reduce, mask, or randomize some of these characteristics.
        </p>
        <div className="capability-notes" aria-label="Important technical boundaries">
          <article>
            <p>OFFLINE AUDIO IS NOT A MICROPHONE</p>
            <span>A synthetic signal was rendered into memory. That trace never reached your speakers, and no sound around you was captured.</span>
          </article>
          <article>
            <p>HISTORY COUNT IS NOT HISTORY CONTENTS</p>
            <span>The page saw this tab's entry count, not the addresses. A referring URL appears only when browser policy provides one.</span>
          </article>
          <article>
            <p>STORAGE ESTIMATE IS ORIGIN-SCOPED</p>
            <span>The estimate concerns storage for this site's origin. It cannot browse your drive or read personal files.</span>
          </article>
          <article>
            <p>HIGH-ENTROPY DOES NOT MEAN UNMASKED</p>
            <span>Your browser may reduce, withhold, or deliberately fictionalize Client Hint values.</span>
          </article>
        </div>
      </section>

      <section className="debrief-section">
        <p className="section-index">OBSERVED THIS SESSION</p>
        <div className="receipt-table" role="table" aria-label="Browser information observed this session">
          <div className="receipt-row receipt-row--head" role="row">
            <span role="columnheader">Information</span>
            <span role="columnheader">Observed value</span>
            <span role="columnheader">Source</span>
          </div>
          {signals.map((signal) => (
            <div className="receipt-row" role="row" key={signal.id}>
              <strong role="cell">{signal.label}</strong>
              <span role="cell">{signal.value}</span>
              <span role="cell">{signal.source}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="debrief-section debrief-split">
        <div>
          <p className="section-index">PERMISSION-GATED</p>
          <dl className="plain-receipt">
            <div><dt>Precise location</dt><dd>{locationLabel(locationStatus)}</dd></div>
            <div><dt>Camera</dt><dd>Never requested</dd></div>
            <div><dt>Microphone</dt><dd>Never requested</dd></div>
          </dl>
        </div>
        <div>
          <p className="section-index">NOT OBSERVED</p>
          <dl className="plain-receipt">
            {notObserved.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
        </div>
      </section>

      <section className="privacy-receipt" aria-labelledby="privacy-receipt-title">
        <div>
          <p className="section-index">PRIVACY RECEIPT</p>
          <h3 id="privacy-receipt-title">Nothing followed you out.</h3>
        </div>
        <dl>
          <div><dt>Tracking cookies set</dt><dd>None</dd></div>
          <div><dt>Local or session storage</dt><dd>None</dd></div>
          <div><dt>Analytics</dt><dd>None</dd></div>
          <div><dt>Third-party lookup services</dt><dd>None</dd></div>
          <div><dt>Fingerprint database</dt><dd>None</dd></div>
          <div><dt>Persistent profile</dt><dd>None</dd></div>
        </dl>
        <p className="receipt-note">
          The canvas, graphics-extension, silent-audio, and profile hashes were calculated locally in memory and were
          not stored. Like every website, the host serving these files necessarily receives an ordinary HTTP request;
          UNKNOWN adds no telemetry or tracking request of its own.
        </p>
      </section>

      <footer className="debrief-footer">
        <div>
          <p className="section-index">THE POINT</p>
          <p>Deleting cookies matters. It just does not erase every characteristic a browser can reveal.</p>
        </div>
        <button className="restart-button" type="button" onClick={onRestart}>RESTART EXPERIENCE</button>
      </footer>
    </main>
  );
}
