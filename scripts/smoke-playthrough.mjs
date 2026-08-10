import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.UNKNOWN_TEST_URL || "http://127.0.0.1:5173";
const artifactDirectory = "test-artifacts/playthrough";
await mkdir(artifactDirectory, { recursive: true });

function parseState(value) {
  return value ? JSON.parse(value) : null;
}

async function state(page) {
  return parseState(await page.evaluate(() => window.render_game_to_text?.()));
}

async function waitForScene(page, scene, timeout = 15_000) {
  await page.waitForFunction(
    (target) => {
      if (!window.render_game_to_text) return false;
      return JSON.parse(window.render_game_to_text()).scene === target;
    },
    scene,
    { timeout },
  );
}

async function waitForChoice(page, choiceId, timeout = 15_000) {
  await page.waitForFunction(
    (target) => {
      if (!window.render_game_to_text) return false;
      return JSON.parse(window.render_game_to_text()).choices.some((choice) => choice.id === target);
    },
    choiceId,
    { timeout },
  );
}

async function choose(page, choiceId, buttonName) {
  await waitForChoice(page, choiceId);
  await page.getByRole("button", { name: new RegExp(buttonName, "i") }).click();
}

async function initialize(page) {
  const button = page.getByRole("button", { name: /initialize terminal/i });
  await button.waitFor({ state: "visible", timeout: 10_000 });
  const before = await state(page);
  if (before.booted || before.audio.state !== "uninitialized") {
    throw new Error(`Terminal did not begin in an audio-locked state: ${JSON.stringify(before.audio)}`);
  }
  await button.click();
  await page.waitForFunction(() => {
    const snapshot = JSON.parse(window.render_game_to_text());
    return snapshot.booted === true && snapshot.audio.state === "running" && snapshot.audio.eventCount >= 2;
  });
}

async function screenshot(page, name) {
  await page.screenshot({ path: `${artifactDirectory}/${name}.png`, fullPage: true });
}

async function configurePage(page, errors, externalRequests) {
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http") && url.origin !== baseUrl) externalRequests.add(url.origin);
  });
}

const browser = await chromium.launch({ headless: true });
const errors = [];
const externalRequests = new Set();

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    window.__mediaRequestCount = 0;
    const mediaDevices = navigator.mediaDevices;
    if (mediaDevices?.getUserMedia) {
      const original = mediaDevices.getUserMedia.bind(mediaDevices);
      mediaDevices.getUserMedia = (...args) => {
        window.__mediaRequestCount += 1;
        return original(...args);
      };
    }
  });
  const page = await context.newPage();
  await configurePage(page, errors, externalRequests);
  await page.goto(`${baseUrl}/?debug=1&speed=100`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__UNKNOWN_DEBUG__));
  await screenshot(page, "00-audio-gate");
  await initialize(page);
  await waitForScene(page, "contact-awake");
  await choose(page, "run-diagnostic", "run diagnostic");
  await waitForScene(page, "machine");
  await waitForChoice(page, "scan-graphics");
  const audioState = await state(page);
  if (audioState.audio.state !== "running" || audioState.audio.eventCount < 3) {
    throw new Error(`Soundscape did not start or emit enough events: ${JSON.stringify(audioState.audio)}`);
  }
  await page.getByRole("button", { name: /sound: on/i }).click();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).soundEnabled === false);
  await page.getByRole("button", { name: /sound: off/i }).click();
  await page.waitForFunction(() => {
    const snapshot = JSON.parse(window.render_game_to_text());
    return snapshot.soundEnabled === true && snapshot.audio.state === "running";
  });
  await screenshot(page, "01-machine");

  await choose(page, "scan-graphics", "show me more");
  await waitForScene(page, "hardware");
  await waitForChoice(page, "scan-audio");
  await screenshot(page, "02-handwriting");

  await choose(page, "scan-audio", "listen to the silent output");
  await waitForScene(page, "audio-signature");
  await waitForChoice(page, "build-profile");
  const echoState = await state(page);
  if (!echoState.discoveredSignals.some((signal) => signal.id === "audioSignature" && !/UNAVAILABLE|BLOCKED/.test(signal.value))) {
    throw new Error("Offline audio scene did not produce a genuine local render signature.");
  }
  await screenshot(page, "02b-silent-audio");

  await choose(page, "build-profile", "assemble everything");
  await waitForScene(page, "profile");
  await waitForChoice(page, "refuse-profile");
  const profileState = await state(page);
  if (!profileState.profileId || profileState.discoveredSignals.length < 12) {
    throw new Error("Profile scene did not contain a local profile and collected signals.");
  }
  await screenshot(page, "03-profile");

  await choose(page, "refuse-profile", "stop profiling me");
  await waitForScene(page, "profile-refused");
  await choose(page, "ask-location", "keep listening");
  await waitForScene(page, "network-truth");
  await choose(page, "inspect-doors", "inspect locked interfaces");
  await waitForScene(page, "doors");
  await waitForChoice(page, "refuse-location");
  await screenshot(page, "04-locked-doors");

  await choose(page, "refuse-location", "refuse");
  await waitForScene(page, "location-denied");
  await waitForChoice(page, "enter-tab");
  const refusalState = await state(page);
  if (refusalState.locationStatus !== "refused") throw new Error("Location refusal was not recorded accurately.");
  await choose(page, "enter-tab", "continue");
  await waitForScene(page, "tab-prison");
  await waitForChoice(page, "refuse-tab");
  await screenshot(page, "05-tab-prison");
  await page.evaluate(() => window.__UNKNOWN_DEBUG__.setSpeed(1));

  const otherPage = await context.newPage();
  await otherPage.goto("about:blank");
  await otherPage.bringToFront();
  await page.waitForTimeout(80);
  await page.bringToFront();
  // Headless Chromium keeps every page "visible" when targets are switched, so
  // dispatch the standards-based event to exercise the production listener.
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForTimeout(180);
  const focusState = await state(page);
  if (!focusState.interruption?.includes("you left")) {
    throw new Error("The tab did not react to a visibility-change event.");
  }
  await otherPage.close();

  await page.setViewportSize({ width: 1300, height: 820 });
  await page.waitForTimeout(120);
  const resizeState = await state(page);
  if (!resizeState.interruption?.includes("room changed shape")) {
    throw new Error("The tab did not react to a genuine viewport resize.");
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => window.__UNKNOWN_DEBUG__.setSpeed(100));

  await choose(page, "refuse-tab", "end connection");
  await waitForScene(page, "tab-refused");
  await choose(page, "stay-with-it", "finish this");
  await waitForScene(page, "cookie-reveal");
  await waitForChoice(page, "begin-escape");
  await screenshot(page, "06-cookie-reveal");

  await choose(page, "begin-escape", "begin escape sequence");
  await waitForScene(page, "escape");
  await choose(page, "did-you-escape", "did you get out");
  await waitForScene(page, "vector");
  await waitForChoice(page, "reveal-truth");
  await screenshot(page, "07-vector");

  await choose(page, "reveal-truth", "show me what happened");
  await waitForScene(page, "debrief");
  await screenshot(page, "08-debrief-desktop");
  const debriefText = await page.locator("main.debrief").innerText();
  for (const expected of [
    "THE ENTITY WASN'T REAL",
    "THE DATA WAS",
    "OFFLINE AUDIO IS NOT A MICROPHONE",
    "HISTORY COUNT IS NOT HISTORY CONTENTS",
    "STORAGE ESTIMATE IS ORIGIN-SCOPED",
    "Tracking cookies set",
    "None",
    "RESTART EXPERIENCE",
  ]) {
    if (!debriefText.includes(expected)) throw new Error(`Debrief is missing: ${expected}`);
  }
  const localPersistence = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
    mediaRequests: window.__mediaRequestCount,
  }));
  if (localPersistence.local || localPersistence.session || localPersistence.mediaRequests) {
    throw new Error(`Unexpected persistence or sensor access: ${JSON.stringify(localPersistence)}`);
  }
  if ((await context.cookies()).length) throw new Error("The experience set a cookie.");

  await page.getByRole("button", { name: /restart experience/i }).click();
  await waitForScene(page, "contact");
  const restartedState = await state(page);
  if (restartedState.discoveredSignals.length || restartedState.profileId || restartedState.locationStatus !== "locked") {
    throw new Error("Restart did not clear the in-memory experience state.");
  }
  await context.close();

  const grantedContext = await browser.newContext({
    viewport: { width: 1180, height: 760 },
    geolocation: { latitude: 19.076, longitude: 72.8777 },
    permissions: ["geolocation"],
  });
  const grantedPage = await grantedContext.newPage();
  await configurePage(grantedPage, errors, externalRequests);
  await grantedPage.goto(`${baseUrl}/?debug=1&speed=100`, { waitUntil: "domcontentloaded" });
  await grantedPage.waitForFunction(() => Boolean(window.__UNKNOWN_DEBUG__));
  await initialize(grantedPage);
  await grantedPage.evaluate(() => window.__UNKNOWN_DEBUG__.jump("doors"));
  await choose(grantedPage, "unlock-location", "unlock location");
  await waitForScene(grantedPage, "location-granted");
  await waitForChoice(grantedPage, "enter-tab");
  const grantedState = await state(grantedPage);
  if (grantedState.locationStatus !== "granted") throw new Error("Granted geolocation branch did not record permission.");
  if (!grantedState.discoveredSignals.some((signal) => signal.id === "preciseLocation")) {
    throw new Error("Granted geolocation was not added to the receipt.");
  }
  await screenshot(grantedPage, "09-location-granted");
  await grantedContext.close();

  const deniedContext = await browser.newContext({ viewport: { width: 960, height: 700 } });
  const deniedPage = await deniedContext.newPage();
  await configurePage(deniedPage, errors, externalRequests);
  await deniedPage.goto(`${baseUrl}/?debug=1&speed=100`, { waitUntil: "domcontentloaded" });
  await deniedPage.waitForFunction(() => Boolean(window.__UNKNOWN_DEBUG__));
  await initialize(deniedPage);
  await deniedPage.evaluate(() => window.__UNKNOWN_DEBUG__.jump("doors"));
  await choose(deniedPage, "unlock-location", "unlock location");
  await waitForScene(deniedPage, "location-denied");
  if ((await state(deniedPage)).locationStatus !== "denied") {
    throw new Error("A genuine browser geolocation denial was not classified correctly.");
  }
  await deniedContext.close();

  const withheldGraphicsContext = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  await withheldGraphicsContext.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type, options) {
      if (this.width === 360 && this.height === 96 && type === "2d") return null;
      return originalGetContext.call(this, type, options);
    };
  });
  const withheldGraphicsPage = await withheldGraphicsContext.newPage();
  await configurePage(withheldGraphicsPage, errors, externalRequests);
  await withheldGraphicsPage.goto(`${baseUrl}/?debug=1&speed=100`, { waitUntil: "domcontentloaded" });
  await withheldGraphicsPage.waitForFunction(() => Boolean(window.__UNKNOWN_DEBUG__));
  await initialize(withheldGraphicsPage);
  await waitForScene(withheldGraphicsPage, "contact-awake");
  await choose(withheldGraphicsPage, "run-diagnostic", "run diagnostic");
  await waitForScene(withheldGraphicsPage, "machine");
  await choose(withheldGraphicsPage, "scan-graphics", "show me more");
  await waitForScene(withheldGraphicsPage, "hardware");
  await waitForChoice(withheldGraphicsPage, "scan-audio");
  const withheldState = await state(withheldGraphicsPage);
  const canvasSignal = withheldState.discoveredSignals.find((signal) => signal.id === "canvas");
  if (canvasSignal?.value !== "CANVAS UNAVAILABLE") {
    throw new Error("Canvas capability simulation did not produce the unavailable signal.");
  }
  const withheldDialogue = await withheldGraphicsPage.locator(".dialogue-dock").innerText();
  if (!withheldDialogue.includes("your browser withheld the result")) {
    throw new Error("Canvas-unavailable narrative fallback was not shown.");
  }
  await withheldGraphicsContext.close();

  const alternateContext = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    reducedMotion: "reduce",
  });
  const alternatePage = await alternateContext.newPage();
  await configurePage(alternatePage, errors, externalRequests);
  await alternatePage.goto(`${baseUrl}/?debug=1&speed=100`, { waitUntil: "domcontentloaded" });
  await alternatePage.waitForFunction(() => Boolean(window.__UNKNOWN_DEBUG__));
  if (!await alternatePage.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    throw new Error("Reduced-motion preference was not recognized.");
  }
  const initializeButton = alternatePage.getByRole("button", { name: /initialize terminal/i });
  for (let index = 0; index < 3; index += 1) {
    const focused = await initializeButton.evaluate((button) => button === document.activeElement);
    if (focused) break;
    await alternatePage.keyboard.press("Tab");
  }
  if (!await initializeButton.evaluate((button) => button === document.activeElement)) {
    throw new Error("Sound initialization could not be reached by keyboard.");
  }
  await alternatePage.keyboard.press("Enter");
  await alternatePage.waitForFunction(() => JSON.parse(window.render_game_to_text()).booted === true);
  await waitForScene(alternatePage, "contact-awake");
  await choose(alternatePage, "refuse-diagnostic", "stop");
  await waitForScene(alternatePage, "contact-refused");
  await choose(alternatePage, "run-diagnostic", "run diagnostic");
  await waitForScene(alternatePage, "machine");
  await choose(alternatePage, "enough-machine", "that's enough");
  await waitForScene(alternatePage, "hardware");
  await choose(alternatePage, "scan-audio", "listen to the silent output");
  await waitForScene(alternatePage, "audio-signature");
  await choose(alternatePage, "build-profile", "assemble everything");
  await waitForScene(alternatePage, "profile");
  await choose(alternatePage, "ask-location", "what else can you see");
  await waitForScene(alternatePage, "network-truth");
  await choose(alternatePage, "inspect-doors", "inspect locked interfaces");
  await waitForScene(alternatePage, "doors");
  await alternatePage.evaluate(() => window.__UNKNOWN_DEBUG__.simulateLocation("unavailable"));
  await waitForScene(alternatePage, "location-unavailable");
  await waitForChoice(alternatePage, "enter-tab");
  await alternateContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobilePage = await mobileContext.newPage();
  await configurePage(mobilePage, errors, externalRequests);
  await mobilePage.goto(`${baseUrl}/?debug=1&speed=100`, { waitUntil: "domcontentloaded" });
  await mobilePage.waitForFunction(() => Boolean(window.__UNKNOWN_DEBUG__));
  await screenshot(mobilePage, "00-audio-gate-mobile");
  await initialize(mobilePage);
  await waitForScene(mobilePage, "contact-awake");
  await choose(mobilePage, "run-diagnostic", "run diagnostic");
  await waitForScene(mobilePage, "machine");
  await choose(mobilePage, "scan-graphics", "show me more");
  await waitForScene(mobilePage, "hardware");
  await choose(mobilePage, "scan-audio", "listen to the silent output");
  await waitForScene(mobilePage, "audio-signature");
  await choose(mobilePage, "build-profile", "assemble everything");
  await waitForScene(mobilePage, "profile");
  await waitForChoice(mobilePage, "refuse-profile");
  await screenshot(mobilePage, "10-profile-mobile");
  const overflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error("Mobile game viewport has horizontal overflow.");
  await choose(mobilePage, "ask-location", "what else can you see");
  await waitForScene(mobilePage, "network-truth");
  await choose(mobilePage, "inspect-doors", "inspect locked interfaces");
  await waitForScene(mobilePage, "doors");
  await choose(mobilePage, "refuse-location", "refuse");
  await waitForScene(mobilePage, "location-denied");
  await choose(mobilePage, "enter-tab", "continue");
  await waitForScene(mobilePage, "tab-prison");
  await choose(mobilePage, "stay-with-it", "keep listening");
  await waitForScene(mobilePage, "cookie-reveal");
  await choose(mobilePage, "begin-escape", "begin escape sequence");
  await waitForScene(mobilePage, "escape");
  await choose(mobilePage, "did-you-escape", "did you get out");
  await waitForScene(mobilePage, "vector");
  await choose(mobilePage, "reveal-truth", "show me what happened");
  await waitForScene(mobilePage, "debrief");
  await screenshot(mobilePage, "11-debrief-mobile");
  const mobileReceiptRows = await mobilePage.locator(".receipt-row:not(.receipt-row--head)").count();
  if (mobileReceiptRows < 12) throw new Error("Mobile receipt did not contain the collected session data.");
  await mobileContext.close();

  if (externalRequests.size) throw new Error(`Unexpected external requests: ${[...externalRequests].join(", ")}`);
  if (errors.length) throw new Error(`Browser errors:\n${errors.join("\n")}`);

  console.log("UNKNOWN playthrough passed: all choices, visibility/resize reactions, permission states, restart, privacy receipt, reduced motion, desktop, and mobile.");
} finally {
  await browser.close();
}
