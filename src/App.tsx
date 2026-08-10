import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserTree } from "./components/BrowserTree";
import { DebugPanel } from "./components/DebugPanel";
import { EyeCanvas } from "./components/EyeCanvas";
import { FinalReveal } from "./components/FinalReveal";
import { ProfileNexus } from "./components/ProfileNexus";
import { SignalReadout } from "./components/SignalReadout";
import { TerminalDialogue } from "./components/TerminalDialogue";
import { SCENES } from "./content/narrative";
import { useNarrativeEngine } from "./hooks/useNarrativeEngine";
import { audioEngine } from "./lib/audioEngine";
import {
  collectAudioSignals,
  collectEnvironmentSignals,
  collectGraphicsSignals,
  createLocalProfileId,
  requestPreciseLocation,
} from "./lib/browserIntelligence";
import { gameClock } from "./lib/gameClock";
import type {
  BrowserSignal,
  GameSnapshot,
  LocationStatus,
  PreciseLocation,
  SceneId,
} from "./types";

const rank: Record<SceneId, number> = {
  contact: 0, "contact-awake": 0, "contact-refused": 0,
  machine: 1, hardware: 2, "audio-signature": 2, profile: 3, "profile-refused": 3,
  "network-truth": 4, doors: 5, "location-request": 5,
  "location-granted": 5, "location-denied": 5, "location-unavailable": 5,
  "tab-prison": 6, "tab-refused": 6, "cookie-reveal": 7,
  escape: 8, vector: 8, debrief: 9,
};

function faviconFor(corruption: number) {
  const stroke = corruption >= 6 ? "%23b7635a" : "%23d8d3c7";
  const pupil = corruption >= 6 ? "%23713b40" : "%23070808";
  return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%23070808'/><path d='M3 16s5-8 13-8 13 8 13 8-5 8-13 8S3 16 3 16Z' fill='none' stroke='${stroke}' stroke-width='2'/><circle cx='16' cy='16' r='4' fill='${pupil}' stroke='${stroke}'/></svg>`;
}

export default function App() {
  const [booted, setBooted] = useState(false);
  const [sceneId, setSceneId] = useState<SceneId>("contact");
  const [signals, setSignals] = useState<BrowserSignal[]>([]);
  const [profileId, setProfileId] = useState("");
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("locked");
  const [location, setLocation] = useState<PreciseLocation>();
  const [refusalCount, setRefusalCount] = useState(0);
  const [pointerSeen, setPointerSeen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [interruption, setInterruption] = useState<string>();
  const interruptionVersion = useRef(0);
  const initialViewport = useRef({ width: window.innerWidth, height: window.innerHeight });

  const scene = SCENES[sceneId];
  const signalLookup = useCallback((id: string, fallback = "HIDDEN BY BROWSER") => {
    return signals.find((signal) => signal.id === id)?.value ?? fallback;
  }, [signals]);

  const narrativeContext = useMemo(() => ({
    signal: signalLookup,
    profileId: profileId || "ASSEMBLING",
    locationStatus,
    location,
    refusalCount,
  }), [location, locationStatus, profileId, refusalCount, signalLookup]);

  const narrative = useNarrativeEngine(scene, narrativeContext, !booted);
  const visibleChoices = narrative.complete ? scene.choices : [];

  const initializeTerminal = useCallback(async () => {
    if (booted) return;
    await audioEngine.start();
    audioEngine.choice();
    setPointerSeen(true);
    setBooted(true);
  }, [booted]);

  const showInterruption = useCallback((message: string) => {
    audioEngine.interruption();
    const version = ++interruptionVersion.current;
    setInterruption(message);
    void gameClock.wait(3400).then(() => {
      if (interruptionVersion.current === version) setInterruption(undefined);
    });
  }, []);

  useEffect(() => {
    if (sceneId === "contact" && narrative.complete && pointerSeen) {
      void gameClock.wait(280).then(() => setSceneId("contact-awake"));
    }
  }, [narrative.complete, pointerSeen, sceneId]);

  useEffect(() => {
    document.title = scene.title || " ";
    document.body.dataset.corruption = String(scene.corruption);
    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.href = faviconFor(scene.corruption);
    audioEngine.transition(scene.corruption);
  }, [scene.corruption, scene.title, sceneId]);

  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden && rank[sceneId] >= 6 && sceneId !== "debrief") {
        showInterruption("you left.\nI don't know where you went.");
      }
    };
    const onResize = () => {
      if (rank[sceneId] < 6 || sceneId === "debrief") return;
      const moved = Math.abs(window.innerWidth - initialViewport.current.width) > 54
        || Math.abs(window.innerHeight - initialViewport.current.height) > 54;
      if (moved) showInterruption("something moved.\nthe room changed shape.");
    };
    const onOrientation = () => {
      if (rank[sceneId] >= 6 && sceneId !== "debrief") showInterruption("the room turned.");
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onOrientation);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onOrientation);
    };
  }, [sceneId, showInterruption]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, button")) return;
      if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.();
      else void document.exitFullscreen?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const addLocationSignal = useCallback((coordinates: PreciseLocation) => {
    setSignals((current) => [
      ...current.filter((signal) => signal.id !== "preciseLocation"),
      {
        id: "preciseLocation",
        label: "PRECISE LOCATION",
        value: `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)} (±${Math.round(coordinates.accuracy)} m)`,
        source: "Permission-gated Geolocation API",
        sensitivity: "sensitive",
        requiresPermission: true,
        category: "sensor",
        available: true,
      },
    ]);
  }, []);

  const handleChoice = useCallback(async (choiceId: string) => {
    setActionPending(true);
    await audioEngine.start();
    audioEngine.choice();

    switch (choiceId) {
      case "make-contact":
        setPointerSeen(true);
        setSceneId("contact-awake");
        break;
      case "run-diagnostic": {
        audioEngine.diagnostic(0.9);
        const environment = await collectEnvironmentSignals();
        setSignals(environment);
        setProfileId(await createLocalProfileId(environment));
        setSceneId("machine");
        break;
      }
      case "refuse-diagnostic":
        setRefusalCount((count) => count + 1);
        setSceneId("contact-refused");
        break;
      case "scan-graphics":
      case "enough-machine": {
        audioEngine.diagnostic(1.15);
        if (choiceId === "enough-machine") {
          setRefusalCount((count) => count + 1);
          showInterruption("I heard you.\nthe interface was already open.");
        }
        const graphics = await collectGraphicsSignals();
        const combined = [...signals.filter((signal) => signal.category !== "graphics"), ...graphics];
        setSignals(combined);
        setProfileId(await createLocalProfileId(combined));
        setSceneId("hardware");
        break;
      }
      case "scan-audio": {
        audioEngine.silence();
        const audio = await collectAudioSignals();
        const combined = [...signals.filter((signal) => signal.category !== "audio"), ...audio];
        setSignals(combined);
        setProfileId(await createLocalProfileId(combined));
        setSceneId("audio-signature");
        break;
      }
      case "build-profile":
        audioEngine.diagnostic(1.4);
        setProfileId(await createLocalProfileId(signals));
        setSceneId("profile");
        break;
      case "ask-location":
        setSceneId("network-truth");
        break;
      case "refuse-profile":
        setRefusalCount((count) => count + 1);
        setSceneId("profile-refused");
        break;
      case "inspect-doors":
        setSceneId("doors");
        break;
      case "unlock-location": {
        audioEngine.permission();
        setLocationStatus("requesting");
        setSceneId("location-request");
        const resultPromise = requestPreciseLocation();
        const result = await resultPromise;
        setLocationStatus(result.status);
        if (result.status === "granted" && result.location) {
          setLocation(result.location);
          addLocationSignal(result.location);
          setSceneId("location-granted");
        } else if (result.status === "denied") {
          setRefusalCount((count) => count + 1);
          setSceneId("location-denied");
        } else {
          setSceneId("location-unavailable");
        }
        break;
      }
      case "refuse-location":
        setLocationStatus("refused");
        setRefusalCount((count) => count + 1);
        setSceneId("location-denied");
        break;
      case "enter-tab":
        setSceneId("tab-prison");
        break;
      case "stay-with-it":
        setSceneId("cookie-reveal");
        break;
      case "refuse-tab":
        setRefusalCount((count) => count + 1);
        setSceneId("tab-refused");
        break;
      case "begin-escape":
        audioEngine.escape();
        setSceneId("escape");
        break;
      case "did-you-escape":
        setSceneId("vector");
        break;
      case "reveal-truth":
        audioEngine.silence();
        setSceneId("debrief");
        window.scrollTo({ top: 0, behavior: "instant" });
        break;
      default:
        break;
    }
    setActionPending(false);
  }, [addLocationSignal, showInterruption, signals]);

  const restart = useCallback(() => {
    setSignals([]);
    setProfileId("");
    setLocationStatus("locked");
    setLocation(undefined);
    setRefusalCount(0);
    setPointerSeen(false);
    setInterruption(undefined);
    setSceneId("contact");
    audioEngine.reset();
    gameClock.resetSpeed();
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const simulateLocation = useCallback((result: "granted" | "denied" | "unavailable") => {
    if (result === "granted") {
      const coordinates = { latitude: 12.9716, longitude: 77.5946, accuracy: 42 };
      setLocation(coordinates);
      setLocationStatus("granted");
      addLocationSignal(coordinates);
      setSceneId("location-granted");
    } else if (result === "denied") {
      setLocationStatus("denied");
      setSceneId("location-denied");
    } else {
      setLocationStatus("unavailable");
      setSceneId("location-unavailable");
    }
  }, [addLocationSignal]);

  const currentSnapshot = useMemo<GameSnapshot>(() => ({
    scene: sceneId,
    act: scene.act,
    room: scene.room,
    dialogue: narrative.history.map((line) => line.text),
    currentlyTyping: narrative.currentlyTyping,
    choices: visibleChoices,
    narrativeComplete: narrative.complete,
    profileCompleteness: scene.completeness,
    profileId,
    discoveredSignals: signals.map(({ id, label, value }) => ({ id, label, value })),
    locationStatus,
    soundEnabled,
    booted,
    audio: audioEngine.getDebugState(),
    interruption,
  }), [booted, interruption, locationStatus, narrative.complete, narrative.currentlyTyping, narrative.history, profileId, scene, sceneId, signals, soundEnabled, visibleChoices]);
  const snapshotRef = useRef(currentSnapshot);
  snapshotRef.current = currentSnapshot;

  useEffect(() => {
    window.render_game_to_text = () => JSON.stringify({
      coordinateSystem: "CSS pixels; origin top-left; x increases right; y increases down",
      ...snapshotRef.current,
    });
    window.advanceTime = (milliseconds: number) => gameClock.advance(milliseconds);
  }, []);

  const debugEnabled = import.meta.env.DEV && new URLSearchParams(window.location.search).get("debug") === "1";
  useEffect(() => {
    if (!debugEnabled) return;
    window.__COOKIE_DEBUG__ = {
      jump: setSceneId,
      reset: restart,
      setSpeed: (speed) => gameClock.setSpeed(speed),
      simulateLocation,
      snapshot: () => snapshotRef.current,
    };
    const requestedSpeed = Number(new URLSearchParams(window.location.search).get("speed") || 1);
    gameClock.setSpeed(requestedSpeed);
    return () => {
      delete window.__COOKIE_DEBUG__;
      gameClock.resetSpeed();
    };
  }, [debugEnabled, restart, simulateLocation]);

  if (sceneId === "debrief") {
    return <FinalReveal signals={signals} locationStatus={locationStatus} onRestart={restart} />;
  }

  const environmentSignals = signals.filter((signal) => signal.category !== "graphics" && signal.category !== "audio" && signal.category !== "sensor");
  const graphicsSignals = signals.filter((signal) => signal.category === "graphics");
  const audioSignals = signals.filter((signal) => signal.category === "audio");
  const visibleSignals = rank[sceneId] === 1
    ? environmentSignals.slice(0, 10)
    : sceneId === "hardware"
      ? graphicsSignals
      : sceneId === "audio-signature"
        ? audioSignals
      : rank[sceneId] >= 3
        ? [...environmentSignals.slice(0, 4), ...graphicsSignals.slice(-3), ...audioSignals, ...signals.filter((signal) => signal.category === "sensor")]
        : [];
  const nexusVisible = rank[sceneId] >= 3 && rank[sceneId] <= 8;

  return (
    <main className={`game-shell corruption-${scene.corruption}`}>
      <EyeCanvas
        mood={scene.mood}
        corruption={scene.corruption}
        onPointerSeen={() => {
          if (booted) setPointerSeen(true);
        }}
      />

      <div className="game-hud">
        <header className="top-bar">
          <div className="wordmark"><strong>COOKIE</strong><span>{scene.act}</span></div>
          <div className="top-meta">
            <span className="room-path">{scene.room}</span>
            <button
              className="sound-toggle"
              type="button"
              aria-pressed={soundEnabled}
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) {
                  audioEngine.setEnabled(true);
                  void audioEngine.start().then(() => audioEngine.choice());
                } else {
                  audioEngine.choice();
                  audioEngine.setEnabled(false);
                }
              }}
            >
              SOUND: {soundEnabled ? "ON" : "OFF"}
            </button>
            <span className="fullscreen-hint" aria-label="Press F to toggle fullscreen">F / FULLSCREEN</span>
          </div>
        </header>

        {rank[sceneId] >= 1 && (
          <div className="profile-meter" aria-label={`Profile completeness, a narrative meter, ${scene.completeness} percent`}>
            <div><span>PROFILE COMPLETENESS</span><small>NARRATIVE INDEX — NOT A PROBABILITY</small></div>
            <div className="meter-track"><span style={{ width: `${scene.completeness}%` }} /></div>
            <strong>{scene.completeness}%</strong>
          </div>
        )}

        <BrowserTree
          scene={sceneId}
          locationStatus={locationStatus}
          hasEnvironment={environmentSignals.length > 0}
          hasGraphics={graphicsSignals.length > 0}
          hasAudio={audioSignals.length > 0}
          hasProfile={rank[sceneId] >= 3 && Boolean(profileId)}
        />
        <SignalReadout signals={visibleSignals} heading={sceneId === "hardware" ? "GRAPHICS TRACE" : sceneId === "audio-signature" ? "SILENT AUDIO TRACE" : "OBSERVED"} />
        <ProfileNexus visible={nexusVisible} signals={signals} profileId={profileId} completeness={scene.completeness} />

        {interruption && <div className="interruption" role="status">{interruption}</div>}

        <TerminalDialogue
          history={narrative.history}
          currentlyTyping={narrative.currentlyTyping}
          tone={narrative.currentTone}
          complete={narrative.complete}
          choices={sceneId === "contact" && pointerSeen ? [] : visibleChoices}
          pending={actionPending}
          onChoice={(choiceId) => void handleChoice(choiceId)}
          onSkip={narrative.skipLine}
        />

        {!booted && (
          <section className="boot-gate" aria-label="Initialize COOKIE with sound">
            <div className="boot-status" aria-hidden="true">
              <span>AUDIO OUTPUT</span><i /><strong>ARMED</strong>
            </div>
            <button className="boot-button" type="button" onClick={() => void initializeTerminal()}>
              <span aria-hidden="true">[</span> INITIALIZE TERMINAL <span aria-hidden="true">]</span>
            </button>
            <p>ONE INPUT REQUIRED BY BROWSER / SOUND BEGINS IMMEDIATELY</p>
          </section>
        )}
      </div>

      {debugEnabled && (
        <DebugPanel
          scene={sceneId}
          snapshot={currentSnapshot}
          onJump={setSceneId}
          onReset={restart}
          onSpeed={(speed) => gameClock.setSpeed(speed)}
          onSimulateLocation={simulateLocation}
        />
      )}
    </main>
  );
}
