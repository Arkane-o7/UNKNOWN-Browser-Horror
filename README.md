# COOKIE

**A browser privacy horror experience.**

COOKIE is a scripted psychological horror game about browser fingerprinting. A vulnerable entity appears to be trapped inside a tab. As the player helps it inspect its prison, ordinary browser characteristics begin to form a recognizable profile.

There is no AI behind the entity, no fake hacking, and no tracking backend. The story is a deterministic narrative state machine; the browser facts shown to the player are collected from APIs available to the page.

> The entity wasn't real. The data was.

## Why it exists

Deleting cookies matters, but cookies are not the only way a browser can look recognizable. Screen characteristics, language, timezone, graphics output, hardware hints, and preferences can form a useful correlation signal when combined. COOKIE makes that abstract privacy lesson felt before explaining it plainly.

A fingerprint is not automatically a legal identity, an exact person, or proof of uniqueness. Browsers may coarsen, mask, or randomize the values exposed to sites. The ending calls out those limits and shows a session-specific receipt of what was—and was not—observed.

## What the experience observes

Only after the player chooses **Run Diagnostic**, COOKIE reads:

- browser family/version and high-entropy build hints from the user agent or User-Agent Client Hints, with withheld and reduced values labeled;
- platform, architecture, bitness, platform-version, and device-model hints where exposed;
- primary language and language list;
- timezone, current UTC offset, calendar, numbering system, and hour-cycle shape from `Intl`;
- screen and available-window size, orientation, viewport size, pixel ratio, and color depth;
- logical CPU concurrency, where exposed;
- coarsened device memory, where exposed;
- maximum touch points and pointer/hover capability media queries;
- reduced-motion, color-scheme, contrast, forced-colors, color-gamut, and dynamic-range queries;
- Do Not Track and Global Privacy Control signals, where exposed;
- coarse network connection class, downlink, round-trip-time, and data-saver estimates where exposed;
- the referring page only if referrer policy supplies it, plus this tab's history-entry count—not history addresses;
- a conservative, origin-scoped storage usage/quota estimate—not files or whole-disk information;
- WebGL version, vendor, renderer, implementation limits, and a local hash of the supported-extension list;
- a locally hashed result of a deterministic, hidden Canvas rendering;
- a locally hashed deterministic `OfflineAudioContext` render and its sample rate, without microphone access;
- PDF-viewer and cookie-support capability flags. COOKIE still sets no cookies.

The game combines the observed values into a short **local profile signature**. It is a narrative/session signature, not a claim of global uniqueness or identity confidence.

## Permission-gated information

Precise geolocation is the only sensitive API the game can request. It is requested only when the player explicitly chooses **Unlock Location**, using the browser's native permission prompt. A refusal, browser denial, timeout, or unavailable API all have complete story branches.

If coordinates are granted, the latitude, longitude, and reported accuracy remain in React state in the current tab. COOKIE does not transmit or store them.

Camera and microphone are deliberately left locked for the entire experience. They are never requested. The silent-audio scene uses `OfflineAudioContext`: the browser computes a synthetic signal directly into memory, without sending that trace to the speakers or recording the room. Its displayed sample rate is the requested offline render rate, not a claim about the physical audio device.

## What it does not observe

COOKIE does not access or claim to know:

- the player's name, passwords, browsing-history contents, personal files, contacts, or messages;
- the contents of other tabs or which tab the player visits;
- installed applications;
- camera or microphone data;
- an IP-derived city or region.

Approximate IP geolocation was intentionally omitted because using a third-party lookup would disclose the visit to another service. The story explains that boundary instead of pretending the browser directly reveals a city.

## Privacy architecture

- No tracking cookies are created.
- No `localStorage`, `sessionStorage`, IndexedDB, or other persistent profile is used.
- No analytics, fingerprint database, advertising code, or third-party lookup service is included.
- Canvas, WebGL-extension, offline-audio, and profile hashes are calculated locally with the Web Crypto API and kept only in memory.
- Fonts and all other assets are bundled with the application.
- Restarting clears all collected narrative and profile state.
- Closing or reloading the tab discards the in-memory state.

Like every hosted website, the server delivering the application necessarily receives an ordinary HTTP request and may keep infrastructure logs according to the host's policy. COOKIE itself adds no telemetry or tracking requests. Preserve that guarantee when deploying it.

## Running locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Localhost is treated as a secure browser context, so it can exercise geolocation permissions.

Production build and preview:

```bash
npm run build
npm run preview
```

Deploy production builds over HTTPS. Browsers generally block geolocation on insecure non-local origins.

## Testing

Install Playwright's Chromium binary once if it is not already present:

```bash
npx playwright install chromium
```

With the Vite development server running on port 5173:

```bash
npm run typecheck
npm run test:playthrough
```

The automated playthrough covers every choice, refusal branches, granted and unavailable geolocation outcomes, keyboard sound initialization, reduced motion, visibility and resize reactions, restart behavior, desktop and mobile layouts, and the final privacy receipt. It also fails on unexpected external HTTP requests, browser errors, cookies, web storage, or camera/microphone requests.

Chromium is the automated browser target. The collectors use standards-based capability checks and provide withheld/unavailable narrative fallbacks for Firefox and Safari, but native permission wording and the amount of graphics/device data exposed vary by browser and privacy configuration.

## Architecture

```text
src/
├── content/narrative.ts          authored scenes, timing, choices, branches
├── hooks/useNarrativeEngine.ts   typewriter and scene playback
├── lib/browserIntelligence.ts    signal collection and local hashing
├── lib/gameClock.ts              deterministic timing/test acceleration
├── lib/audioEngine.ts            interaction-started local Web Audio
├── components/                   eyes, browser map, profile, terminal, debrief
└── App.tsx                       central state transitions and permission flow
```

The narrative content is separate from the transition logic, and each collected signal carries its label, value, source, sensitivity, permission requirement, availability, and category. That same in-memory record powers both the horror interface and the final receipt.

Development builds support `?debug=1` for a debug panel that can jump between scenes, accelerate dialogue, inspect state, and simulate permission outcomes. The debug surface is removed by Vite's production build.

## Controls and accessibility

- Activate **Initialize Terminal** once to unlock browser audio before the opening dialogue; it is fully keyboard accessible.
- Move the pointer to direct the optical feeds after initialization.
- Press `F` to toggle fullscreen where the browser permits it.
- Use **Sound: On/Off** at any time. Audio starts only after an interaction.
- Click the active dialogue to reveal the current line immediately.
- All choices are semantic buttons with visible keyboard focus.
- `prefers-reduced-motion` disables blinks, tremors, corruption bands, and long visual transitions without removing narrative content.

## Educational disclaimer

COOKIE is an educational demonstration, not a production fingerprinting library and not a measurement of how unique any particular visitor is. Browser APIs and privacy protections change over time. If the project is extended, keep the core rule intact: when a real browser limitation conflicts with a scarier line, tell the truth.
