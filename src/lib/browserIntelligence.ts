import type { BrowserSignal, LocationResult } from "../types";

type NavigatorWithHints = Navigator & {
  userAgentData?: {
    brands?: Array<{ brand: string; version: string }>;
    mobile?: boolean;
    platform?: string;
    getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>;
  };
  deviceMemory?: number;
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
  globalPrivacyControl?: boolean;
};

const nav = navigator as NavigatorWithHints;

function availableValue(value: unknown, hidden = "HIDDEN BY BROWSER"): string {
  return value === undefined || value === null || value === "" ? hidden : String(value);
}

function detectBrowser(): string {
  const brands = nav.userAgentData?.brands
    ?.filter(({ brand }) => !/not.a.brand/i.test(brand))
    .map(({ brand, version }) => `${brand} ${version}`);
  if (brands?.length) return brands.join(" / ");

  const ua = navigator.userAgent;
  const edge = ua.match(/Edg\/(\d+)/);
  const firefox = ua.match(/Firefox\/(\d+)/);
  const chrome = ua.match(/Chrome\/(\d+)/);
  const safari = ua.match(/Version\/(\d+).+Safari/);
  if (edge) return `Microsoft Edge ${edge[1]}`;
  if (firefox) return `Firefox ${firefox[1]}`;
  if (chrome) return `Chromium ${chrome[1]}`;
  if (safari) return `Safari ${safari[1]}`;
  return "UNIDENTIFIED BROWSER";
}

function detectPlatform(): string {
  if (nav.userAgentData?.platform) return nav.userAgentData.platform;
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS / iPadOS";
  if (/Macintosh|Mac OS X/i.test(ua)) return "macOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return availableValue(navigator.platform);
}

function makeSignal(
  signal: Omit<BrowserSignal, "available"> & { available?: boolean },
): BrowserSignal {
  return {
    ...signal,
    available: signal.available ?? !/HIDDEN|UNAVAILABLE|UNIDENTIFIED|NOT EXPOSED|NOT OBSERVED|BLOCKED/.test(signal.value),
  };
}

function mediaValue(feature: string, values: string[], fallback = "NOT EXPOSED"): string {
  return values.find((value) => window.matchMedia?.(`(${feature}: ${value})`).matches) ?? fallback;
}

function mebibytes(bytes: number | undefined): string {
  return typeof bytes === "number" ? `${(bytes / 1024 / 1024).toFixed(bytes >= 1024 ** 3 ? 0 : 1)} MiB` : "NOT EXPOSED";
}

export async function collectEnvironmentSignals(): Promise<BrowserSignal[]> {
  const international = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions();
    } catch {
      return undefined;
    }
  })();
  const timezone = international?.timeZone;
  const utcOffset = (() => {
    try {
      return new Intl.DateTimeFormat(undefined, { timeZoneName: "longOffset" })
        .formatToParts()
        .find((part) => part.type === "timeZoneName")?.value;
    } catch {
      const minutes = -new Date().getTimezoneOffset();
      const sign = minutes >= 0 ? "+" : "-";
      return `UTC${sign}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, "0")}:${String(Math.abs(minutes) % 60).padStart(2, "0")}`;
    }
  })();
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const colorScheme = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const connection = nav.connection;

  let highEntropy: Record<string, unknown> = {};
  try {
    highEntropy = await nav.userAgentData?.getHighEntropyValues?.([
      "architecture",
      "bitness",
      "model",
      "platformVersion",
      "uaFullVersion",
      "fullVersionList",
      "wow64",
    ]) ?? {};
  } catch {
    highEntropy = {};
  }

  let storageUsage: number | undefined;
  let storageQuota: number | undefined;
  try {
    const estimate = await navigator.storage?.estimate();
    storageUsage = estimate?.usage;
    storageQuota = estimate?.quota;
  } catch {
    storageUsage = undefined;
    storageQuota = undefined;
  }

  const fullVersionList = Array.isArray(highEntropy.fullVersionList)
    ? highEntropy.fullVersionList
        .filter((item): item is { brand: string; version: string } => Boolean(item) && typeof item === "object" && "brand" in item && "version" in item)
        .map(({ brand, version }) => `${brand} ${version}`)
        .join(" / ")
    : availableValue(highEntropy.uaFullVersion);
  const pointer = `${mediaValue("pointer", ["fine", "coarse", "none"])} / ${mediaValue("hover", ["hover", "none"])}`;
  const anyPointer = ["fine", "coarse"].filter((value) => window.matchMedia?.(`(any-pointer: ${value})`).matches).join(" + ") || "none";
  const colorGamut = mediaValue("color-gamut", ["rec2020", "p3", "srgb"]);
  const contrast = mediaValue("prefers-contrast", ["more", "less", "custom", "no-preference"]);
  const orientation = screen.orientation
    ? `${screen.orientation.type} / ${screen.orientation.angle}°`
    : window.matchMedia?.("(orientation: portrait)").matches ? "portrait" : "landscape";
  const localeShape = [international?.calendar, international?.numberingSystem, international?.hourCycle]
    .filter(Boolean)
    .join(" / ") || "NOT EXPOSED";
  const storageValue = storageQuota === undefined
    ? "NOT EXPOSED"
    : `${mebibytes(storageUsage)} used / ${mebibytes(storageQuota)} quota (this origin)`;

  return [
    makeSignal({ id: "browser", label: "BROWSER", value: detectBrowser(), source: "Navigator user agent / Client Hints", sensitivity: "moderate", requiresPermission: false, category: "environment" }),
    makeSignal({ id: "browserFull", label: "FULL BROWSER BUILD", value: fullVersionList || "HIDDEN BY BROWSER", source: "High-entropy User-Agent Client Hints (may be reduced or fictionalized)", sensitivity: "moderate", requiresPermission: false, category: "environment", available: Boolean(fullVersionList) }),
    makeSignal({ id: "platform", label: "PLATFORM", value: detectPlatform(), source: "Navigator platform hint", sensitivity: "moderate", requiresPermission: false, category: "environment" }),
    makeSignal({ id: "architecture", label: "CPU ARCHITECTURE HINT", value: availableValue(highEntropy.architecture), source: "High-entropy User-Agent Client Hints (may be withheld)", sensitivity: "moderate", requiresPermission: false, category: "hardware", available: Boolean(highEntropy.architecture) }),
    makeSignal({ id: "bitness", label: "PLATFORM BITNESS HINT", value: availableValue(highEntropy.bitness), source: "High-entropy User-Agent Client Hints (may be withheld)", sensitivity: "moderate", requiresPermission: false, category: "hardware", available: Boolean(highEntropy.bitness) }),
    makeSignal({ id: "platformVersion", label: "PLATFORM VERSION HINT", value: availableValue(highEntropy.platformVersion), source: "High-entropy User-Agent Client Hints (may be reduced or fictionalized)", sensitivity: "moderate", requiresPermission: false, category: "environment", available: Boolean(highEntropy.platformVersion) }),
    makeSignal({ id: "deviceModel", label: "DEVICE MODEL HINT", value: availableValue(highEntropy.model), source: "High-entropy User-Agent Client Hints (often blank on desktops)", sensitivity: "moderate", requiresPermission: false, category: "hardware", available: Boolean(highEntropy.model) }),
    makeSignal({ id: "language", label: "LANGUAGE", value: availableValue(navigator.language), source: "Navigator.language", sensitivity: "moderate", requiresPermission: false, category: "environment" }),
    makeSignal({ id: "languages", label: "LANGUAGES", value: navigator.languages?.join(", ") || "HIDDEN BY BROWSER", source: "Navigator.languages", sensitivity: "moderate", requiresPermission: false, category: "environment" }),
    makeSignal({ id: "timezone", label: "TIMEZONE", value: availableValue(timezone), source: "Intl.DateTimeFormat", sensitivity: "moderate", requiresPermission: false, category: "environment" }),
    makeSignal({ id: "utcOffset", label: "CURRENT UTC OFFSET", value: availableValue(utcOffset), source: "Intl.DateTimeFormat", sensitivity: "moderate", requiresPermission: false, category: "environment" }),
    makeSignal({ id: "localeShape", label: "LOCALE FORMAT", value: localeShape, source: "Intl resolved calendar / numbering system / hour cycle", sensitivity: "low", requiresPermission: false, category: "environment" }),
    makeSignal({ id: "screen", label: "SCREEN", value: `${screen.width} × ${screen.height}`, source: "Screen API", sensitivity: "moderate", requiresPermission: false, category: "display" }),
    makeSignal({ id: "screenAvailable", label: "AVAILABLE SCREEN", value: `${screen.availWidth} × ${screen.availHeight}`, source: "Screen API (space available to windows)", sensitivity: "moderate", requiresPermission: false, category: "display" }),
    makeSignal({ id: "orientation", label: "SCREEN ORIENTATION", value: orientation, source: "Screen Orientation API / media query fallback", sensitivity: "low", requiresPermission: false, category: "display" }),
    makeSignal({ id: "viewport", label: "VIEWPORT", value: `${window.innerWidth} × ${window.innerHeight}`, source: "Window dimensions", sensitivity: "low", requiresPermission: false, category: "display" }),
    makeSignal({ id: "pixelRatio", label: "PIXEL RATIO", value: String(window.devicePixelRatio || 1), source: "Window.devicePixelRatio", sensitivity: "moderate", requiresPermission: false, category: "display" }),
    makeSignal({ id: "colorDepth", label: "COLOR DEPTH", value: `${screen.colorDepth} bit`, source: "Screen API", sensitivity: "moderate", requiresPermission: false, category: "display" }),
    makeSignal({ id: "cpu", label: "CPU THREADS", value: availableValue(navigator.hardwareConcurrency), source: "Navigator.hardwareConcurrency (may be reduced)", sensitivity: "moderate", requiresPermission: false, category: "hardware" }),
    makeSignal({ id: "memory", label: "MEMORY", value: nav.deviceMemory ? `approximately ${nav.deviceMemory} GiB` : "HIDDEN BY BROWSER", source: "Navigator.deviceMemory (coarsened where supported)", sensitivity: "moderate", requiresPermission: false, category: "hardware", available: Boolean(nav.deviceMemory) }),
    makeSignal({ id: "touch", label: "TOUCH POINTS", value: String(navigator.maxTouchPoints || 0), source: "Navigator.maxTouchPoints", sensitivity: "low", requiresPermission: false, category: "hardware" }),
    makeSignal({ id: "pointer", label: "PRIMARY POINTER / HOVER", value: pointer, source: "CSS interaction media queries", sensitivity: "low", requiresPermission: false, category: "hardware" }),
    makeSignal({ id: "anyPointer", label: "AVAILABLE POINTER TYPES", value: anyPointer, source: "CSS any-pointer media query", sensitivity: "low", requiresPermission: false, category: "hardware" }),
    makeSignal({ id: "motion", label: "REDUCED MOTION", value: reducedMotion ? "requested" : "not requested", source: "CSS media query", sensitivity: "low", requiresPermission: false, category: "preferences" }),
    makeSignal({ id: "colorScheme", label: "COLOR SCHEME", value: colorScheme, source: "CSS media query", sensitivity: "low", requiresPermission: false, category: "preferences" }),
    makeSignal({ id: "contrast", label: "CONTRAST PREFERENCE", value: contrast, source: "CSS prefers-contrast media query", sensitivity: "low", requiresPermission: false, category: "preferences", available: contrast !== "NOT EXPOSED" }),
    makeSignal({ id: "forcedColors", label: "FORCED COLORS", value: window.matchMedia?.("(forced-colors: active)").matches ? "active" : "not active", source: "CSS forced-colors media query", sensitivity: "low", requiresPermission: false, category: "preferences" }),
    makeSignal({ id: "colorGamut", label: "DISPLAY COLOR GAMUT", value: colorGamut, source: "CSS color-gamut media query (approximate)", sensitivity: "low", requiresPermission: false, category: "display", available: colorGamut !== "NOT EXPOSED" }),
    makeSignal({ id: "dynamicRange", label: "DISPLAY DYNAMIC RANGE", value: mediaValue("dynamic-range", ["high", "standard"]), source: "CSS dynamic-range media query (capability, not active mode)", sensitivity: "low", requiresPermission: false, category: "display" }),
    makeSignal({ id: "dnt", label: "DO NOT TRACK", value: availableValue(navigator.doNotTrack, "NOT SIGNALLED"), source: "Navigator.doNotTrack", sensitivity: "low", requiresPermission: false, category: "preferences", available: navigator.doNotTrack != null }),
    makeSignal({ id: "gpc", label: "GLOBAL PRIVACY CONTROL", value: nav.globalPrivacyControl === undefined ? "NOT EXPOSED" : nav.globalPrivacyControl ? "enabled" : "disabled", source: "Navigator.globalPrivacyControl", sensitivity: "low", requiresPermission: false, category: "preferences", available: nav.globalPrivacyControl !== undefined }),
    makeSignal({ id: "connection", label: "CONNECTION CLASS", value: connection?.effectiveType || "HIDDEN BY BROWSER", source: "Network Information API", sensitivity: "moderate", requiresPermission: false, category: "environment", available: Boolean(connection?.effectiveType) }),
    makeSignal({ id: "connectionShape", label: "CONNECTION ESTIMATE", value: connection ? `${connection.downlink ?? "?"} Mbps / ${connection.rtt ?? "?"} ms RTT / data saver ${connection.saveData ? "on" : "off"}` : "HIDDEN BY BROWSER", source: "Network Information API (coarsened estimate)", sensitivity: "moderate", requiresPermission: false, category: "environment", available: Boolean(connection) }),
    makeSignal({ id: "referrer", label: "REFERRING PAGE", value: document.referrer || "NONE PROVIDED", source: "Document.referrer (may be reduced or suppressed by policy)", sensitivity: "moderate", requiresPermission: false, category: "environment", available: Boolean(document.referrer) }),
    makeSignal({ id: "historyDepth", label: "TAB HISTORY DEPTH", value: `${history.length} ${history.length === 1 ? "entry" : "entries"}; addresses not exposed`, source: "History.length (count only)", sensitivity: "low", requiresPermission: false, category: "environment" }),
    makeSignal({ id: "storageEstimate", label: "ORIGIN STORAGE ESTIMATE", value: storageValue, source: "StorageManager.estimate (conservative, origin-scoped)", sensitivity: "moderate", requiresPermission: false, category: "environment", available: storageQuota !== undefined }),
    makeSignal({ id: "pdfViewer", label: "PDF VIEWER", value: navigator.pdfViewerEnabled === undefined ? "NOT EXPOSED" : navigator.pdfViewerEnabled ? "enabled" : "disabled", source: "Navigator.pdfViewerEnabled", sensitivity: "low", requiresPermission: false, category: "environment", available: navigator.pdfViewerEnabled !== undefined }),
    makeSignal({ id: "cookieSupport", label: "COOKIE SUPPORT", value: navigator.cookieEnabled ? "enabled (UNKNOWN sets none)" : "disabled", source: "Navigator.cookieEnabled", sensitivity: "low", requiresPermission: false, category: "environment" }),
  ];
}

async function digest(value: string): Promise<string> {
  if (crypto.subtle) {
    const bytes = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(16).padStart(8, "0").toUpperCase().repeat(8);
}

function grouped(hash: string, groups = 4): string {
  return hash.slice(0, groups * 4).match(/.{1,4}/g)?.join("-") ?? hash.slice(0, groups * 4);
}

export async function collectGraphicsSignals(): Promise<BrowserSignal[]> {
  const canvas = document.createElement("canvas");
  canvas.width = 360;
  canvas.height = 96;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  let canvasValue = "CANVAS UNAVAILABLE";

  if (context) {
    context.fillStyle = "#111413";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textBaseline = "alphabetic";
    context.font = "17px 'IBM Plex Mono', monospace";
    context.fillStyle = "#d8d3c7";
    context.fillText("UNKNOWN // your computer has handwriting", 13, 36);
    context.globalCompositeOperation = "multiply";
    context.fillStyle = "rgba(135, 164, 142, .83)";
    context.beginPath();
    context.arc(82, 62, 23, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "rgba(180, 91, 80, .72)";
    context.beginPath();
    context.arc(104, 62, 23, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = "source-over";
    context.strokeStyle = "#d8d3c7";
    context.beginPath();
    context.moveTo(154, 58);
    context.bezierCurveTo(170, 42, 250, 82, 340, 47);
    context.stroke();
    canvasValue = grouped(await digest(canvas.toDataURL()), 6);
  }

  const glCanvas = document.createElement("canvas");
  const gl = (glCanvas.getContext("webgl") || glCanvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
  let vendor = "WEBGL UNAVAILABLE";
  let renderer = "WEBGL UNAVAILABLE";
  let webglVersion = "WEBGL UNAVAILABLE";
  let webglLimits = "WEBGL UNAVAILABLE";
  let extensionSignature = "WEBGL UNAVAILABLE";

  if (gl) {
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    vendor = String(debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR));
    renderer = String(debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    webglVersion = String(gl.getParameter(gl.VERSION));
    webglLimits = `${gl.getParameter(gl.MAX_TEXTURE_SIZE)} px texture / ${gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)} px renderbuffer / ${gl.getParameter(gl.MAX_VERTEX_ATTRIBS)} vertex attribs`;
    const extensions = gl.getSupportedExtensions()?.slice().sort() ?? [];
    extensionSignature = `${extensions.length} exposed / ${grouped(await digest(extensions.join("|")), 4)}`;
  }

  return [
    makeSignal({ id: "webgl", label: "WEBGL", value: webglVersion, source: "WebGLRenderingContext", sensitivity: "moderate", requiresPermission: false, category: "graphics", available: Boolean(gl) }),
    makeSignal({ id: "gpuVendor", label: "GPU VENDOR", value: vendor, source: "WebGL renderer parameters (may be masked)", sensitivity: "moderate", requiresPermission: false, category: "graphics", available: Boolean(gl) }),
    makeSignal({ id: "gpuRenderer", label: "GPU RENDERER", value: renderer, source: "WebGL renderer parameters (may be masked)", sensitivity: "moderate", requiresPermission: false, category: "graphics", available: Boolean(gl) }),
    makeSignal({ id: "webglLimits", label: "GRAPHICS LIMITS", value: webglLimits, source: "WebGL implementation limits", sensitivity: "moderate", requiresPermission: false, category: "graphics", available: Boolean(gl) }),
    makeSignal({ id: "webglExtensions", label: "WEBGL EXTENSION SHAPE", value: extensionSignature, source: "Locally hashed WebGL supported-extension list", sensitivity: "moderate", requiresPermission: false, category: "graphics", available: Boolean(gl) }),
    makeSignal({ id: "canvas", label: "CANVAS SIGNATURE", value: canvasValue, source: "Locally hashed deterministic Canvas output", sensitivity: "moderate", requiresPermission: false, category: "graphics", available: Boolean(context) }),
  ];
}

export async function collectAudioSignals(): Promise<BrowserSignal[]> {
  if (!window.OfflineAudioContext) {
    return [
      makeSignal({ id: "audioSignature", label: "OFFLINE AUDIO SIGNATURE", value: "OFFLINE AUDIO UNAVAILABLE", source: "OfflineAudioContext (no microphone)", sensitivity: "moderate", requiresPermission: false, category: "audio", available: false }),
      makeSignal({ id: "audioSampleRate", label: "OFFLINE RENDER SAMPLE RATE", value: "OFFLINE AUDIO UNAVAILABLE", source: "OfflineAudioContext", sensitivity: "low", requiresPermission: false, category: "audio", available: false }),
    ];
  }

  try {
    const sampleRate = 44_100;
    const offline = new OfflineAudioContext(1, sampleRate, sampleRate);
    const oscillator = offline.createOscillator();
    const compressor = offline.createDynamicsCompressor();
    const filter = offline.createBiquadFilter();
    oscillator.type = "triangle";
    oscillator.frequency.value = 997;
    filter.type = "lowpass";
    filter.frequency.value = 3_600;
    filter.Q.value = 0.73;
    compressor.threshold.value = -48;
    compressor.knee.value = 18;
    compressor.ratio.value = 7;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.21;
    oscillator.connect(filter);
    filter.connect(compressor);
    compressor.connect(offline.destination);
    oscillator.start(0);
    const rendered = await offline.startRendering();
    const samples = rendered.getChannelData(0);
    let energy = 0;
    const sampled: string[] = [];
    for (let index = 4_096; index < samples.length; index += 97) {
      energy += Math.abs(samples[index]);
      if (sampled.length < 240) sampled.push(samples[index].toFixed(7));
    }
    const signature = grouped(await digest(`${rendered.sampleRate}|${energy.toFixed(9)}|${sampled.join(",")}`), 6);
    return [
      makeSignal({ id: "audioSignature", label: "OFFLINE AUDIO SIGNATURE", value: signature, source: "Locally hashed deterministic OfflineAudioContext render (no microphone)", sensitivity: "moderate", requiresPermission: false, category: "audio" }),
      makeSignal({ id: "audioSampleRate", label: "OFFLINE RENDER SAMPLE RATE", value: `${rendered.sampleRate} Hz`, source: "OfflineAudioContext rendered buffer (requested render rate)", sensitivity: "low", requiresPermission: false, category: "audio" }),
    ];
  } catch {
    return [
      makeSignal({ id: "audioSignature", label: "OFFLINE AUDIO SIGNATURE", value: "RENDER BLOCKED BY BROWSER", source: "OfflineAudioContext (no microphone)", sensitivity: "moderate", requiresPermission: false, category: "audio", available: false }),
      makeSignal({ id: "audioSampleRate", label: "OFFLINE RENDER SAMPLE RATE", value: "NOT OBSERVED", source: "OfflineAudioContext", sensitivity: "low", requiresPermission: false, category: "audio", available: false }),
    ];
  }
}

export async function createLocalProfileId(signals: BrowserSignal[]): Promise<string> {
  const profileMaterial = signals
    .filter((signal) => signal.category !== "sensor")
    .map(({ id, value }) => `${id}:${value}`)
    .sort()
    .join("|");
  return grouped(await digest(profileMaterial), 3);
}

export function requestPreciseLocation(): Promise<LocationResult> {
  if (!navigator.geolocation || !window.isSecureContext) {
    return Promise.resolve({
      status: "unavailable",
      reason: navigator.geolocation ? "Precise location requires HTTPS or localhost." : "Geolocation API is unavailable.",
    });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          status: "granted",
          location: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          resolve({ status: "denied", reason: "The browser or operating system denied location access." });
        } else if (error.code === error.TIMEOUT) {
          resolve({ status: "timed-out", reason: "The browser did not return a location before the request expired." });
        } else {
          resolve({ status: "unavailable", reason: "The device could not provide a location." });
        }
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 0 },
    );
  });
}
