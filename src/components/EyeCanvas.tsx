import { useEffect, useRef } from "react";
import type { EyeMood } from "../types";

type Point = { x: number; y: number };

interface EyeCanvasProps {
  mood: EyeMood;
  corruption: number;
  hidden?: boolean;
  onPointerSeen: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function terminalEyePath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  openness: number,
) {
  const openHeight = height * openness;
  context.beginPath();
  context.moveTo(x - width / 2, y);
  context.lineTo(x - width * 0.37, y - openHeight * 0.64);
  context.lineTo(x - width * 0.17, y - openHeight);
  context.lineTo(x + width * 0.17, y - openHeight);
  context.lineTo(x + width * 0.37, y - openHeight * 0.64);
  context.lineTo(x + width / 2, y);
  context.lineTo(x + width * 0.37, y + openHeight * 0.64);
  context.lineTo(x + width * 0.17, y + openHeight);
  context.lineTo(x - width * 0.17, y + openHeight);
  context.lineTo(x - width * 0.37, y + openHeight * 0.64);
  context.closePath();
}

function drawCorner(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  horizontalDirection: number,
  verticalDirection: number,
  size: number,
) {
  context.beginPath();
  context.moveTo(x + horizontalDirection * size, y);
  context.lineTo(x, y);
  context.lineTo(x, y + verticalDirection * size);
  context.stroke();
}

function drawTerminalEye(
  context: CanvasRenderingContext2D,
  center: Point,
  size: { width: number; height: number },
  gaze: Point,
  openness: number,
  time: number,
  index: number,
  corruption: number,
) {
  const { width, height } = size;
  const openHeight = height * openness;
  const phosphor = corruption >= 6 ? "#b7635a" : "#9bafa0";
  const bright = corruption >= 6 ? "#cf8177" : "#d8d3c7";
  const dim = corruption >= 6 ? "rgba(183, 99, 90, .24)" : "rgba(135, 153, 140, .24)";
  const irisRadius = height * 0.61;
  const irisX = center.x + gaze.x * width * 0.13;
  const irisY = center.y + gaze.y * height * 0.2;

  context.save();
  terminalEyePath(context, center.x, center.y, width, height, openness);
  context.clip();
  context.fillStyle = corruption >= 6 ? "rgba(77, 25, 24, .19)" : "rgba(76, 105, 86, .1)";
  context.fillRect(center.x - width / 2, center.y - height, width, height * 2);

  const glyphSize = Math.max(7, Math.min(10, width * 0.035));
  const rowHeight = glyphSize + 3;
  const glyphs = ["0", "1", "/", "\\", ":", "+", "[", "]", ".", "="];
  context.font = `${glyphSize}px "IBM Plex Mono", monospace`;
  context.textBaseline = "middle";
  context.fillStyle = phosphor;
  context.globalAlpha = 0.19;
  let row = 0;
  for (let y = center.y - height; y <= center.y + height; y += rowHeight) {
    let raster = "";
    const columns = Math.ceil(width / (glyphSize * 0.58));
    for (let column = 0; column < columns; column += 1) {
      const glyphIndex = (column * 7 + row * 11 + index * 3) % glyphs.length;
      raster += glyphs[glyphIndex];
    }
    const offset = row % 2 ? glyphSize * 0.35 : 0;
    context.fillText(raster, center.x - width / 2 + 3 + offset, y);
    row += 1;
  }

  context.globalAlpha = 0.28;
  context.strokeStyle = phosphor;
  context.lineWidth = 0.65;
  for (let y = center.y - height; y <= center.y + height; y += 5) {
    context.beginPath();
    context.moveTo(center.x - width / 2, y);
    context.lineTo(center.x + width / 2, y);
    context.stroke();
  }
  context.globalAlpha = 1;

  context.strokeStyle = dim;
  context.lineWidth = 1;
  context.setLineDash([3, 5]);
  context.beginPath();
  context.moveTo(center.x - width / 2, irisY);
  context.lineTo(center.x + width / 2, irisY);
  context.moveTo(irisX, center.y - height);
  context.lineTo(irisX, center.y + height);
  context.stroke();

  context.save();
  context.translate(irisX, irisY);
  context.rotate((index ? -1 : 1) * time * 0.000035);
  context.strokeStyle = phosphor;
  context.shadowColor = phosphor;
  context.shadowBlur = 7;
  context.lineWidth = Math.max(1, width * 0.004);
  context.setLineDash([4, 3]);
  context.beginPath();
  context.arc(0, 0, irisRadius, 0, Math.PI * 2);
  context.stroke();
  context.shadowBlur = 0;
  context.setLineDash([1, 4]);
  context.beginPath();
  context.arc(0, 0, irisRadius * 0.72, 0, Math.PI * 2);
  context.stroke();

  context.setLineDash([]);
  context.lineWidth = 1;
  for (let tick = 0; tick < 24; tick += 1) {
    const angle = (tick / 24) * Math.PI * 2;
    const inner = irisRadius * (tick % 3 === 0 ? 0.64 : 0.76);
    const outer = irisRadius * 0.94;
    context.beginPath();
    context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    context.stroke();
  }
  context.restore();

  const pupilPulse = 1 + Math.sin(time * 0.0014 + index) * 0.035 + corruption * 0.004;
  context.fillStyle = "rgba(2, 5, 4, .94)";
  context.strokeStyle = bright;
  context.lineWidth = Math.max(1, width * 0.004);
  context.beginPath();
  context.arc(irisX, irisY, irisRadius * 0.34 * pupilPulse, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.fillStyle = bright;
  const cursorSize = Math.max(3, width * 0.017);
  const cursorBlink = Math.floor(time / 520) % 2 === 0 ? 0.9 : 0.28;
  context.globalAlpha = cursorBlink;
  context.fillRect(irisX - irisRadius * 0.25, irisY - irisRadius * 0.3, cursorSize, cursorSize * 0.72);
  context.globalAlpha = 1;
  context.restore();

  context.save();
  context.strokeStyle = bright;
  context.fillStyle = phosphor;
  context.lineWidth = Math.max(1, width * 0.005);
  context.shadowColor = phosphor;
  context.shadowBlur = corruption >= 6 ? 5 : 3;
  context.setLineDash([Math.max(7, width * 0.04), Math.max(3, width * 0.014)]);
  terminalEyePath(context, center.x, center.y, width, height, openness);
  context.stroke();
  context.setLineDash([]);
  context.shadowBlur = 0;

  if (corruption >= 4) {
    context.strokeStyle = `rgba(183, 99, 90, ${0.12 + corruption * 0.025})`;
    context.lineWidth = 1;
    terminalEyePath(context, center.x + corruption * 0.48, center.y - 1, width, height, openness);
    context.stroke();
  }

  if (openness > 0.28) {
    const bracketOffset = 8;
    const bracketSize = Math.max(5, width * 0.03);
    context.strokeStyle = dim;
    drawCorner(context, center.x - width / 2 - bracketOffset, center.y - openHeight - bracketOffset, 1, 1, bracketSize);
    drawCorner(context, center.x + width / 2 + bracketOffset, center.y - openHeight - bracketOffset, -1, 1, bracketSize);
    drawCorner(context, center.x - width / 2 - bracketOffset, center.y + openHeight + bracketOffset, 1, -1, bracketSize);
    drawCorner(context, center.x + width / 2 + bracketOffset, center.y + openHeight + bracketOffset, -1, -1, bracketSize);

    context.font = `${Math.max(7, Math.min(9, width * 0.034))}px "IBM Plex Mono", monospace`;
    context.letterSpacing = "1px";
    context.fillStyle = phosphor;
    context.globalAlpha = 0.72;
    context.textAlign = index === 0 ? "left" : "right";
    context.textBaseline = "alphabetic";
    context.fillText(
      index === 0 ? `OPTIC/L  PTR ${gaze.x.toFixed(2)}` : `PTR ${gaze.x.toFixed(2)}  OPTIC/R`,
      index === 0 ? center.x - width / 2 : center.x + width / 2,
      center.y + openHeight + 22,
    );
    context.globalAlpha = 1;
  }
  context.restore();
}

export function EyeCanvas({ mood, corruption, hidden = false, onPointerSeen }: EyeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef<Point>({ x: 0, y: 0 });
  const gazeRef = useRef<Point>({ x: 0, y: 0 });
  const pointerSeenRef = useRef(false);
  const awakeRef = useRef(mood !== "dormant" ? 1 : 0.03);
  const timeOffsetRef = useRef(0);
  const nextBlinkRef = useRef(2600);
  const blinkStartRef = useRef(-1000);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      targetRef.current = {
        x: clamp((event.clientX / window.innerWidth) * 2 - 1, -1, 1),
        y: clamp((event.clientY / window.innerHeight) * 2 - 1, -1, 1),
      };
      if (!pointerSeenRef.current) {
        pointerSeenRef.current = true;
        onPointerSeen();
      }
    };
    const onAdvance = (event: Event) => {
      timeOffsetRef.current += (event as CustomEvent<number>).detail || 0;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("cookie:advance", onAdvance);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("cookie:advance", onAdvance);
    };
  }, [onPointerSeen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const render = (rawTime: number) => {
      const time = rawTime + timeOffsetRef.current;
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const backdrop = context.createRadialGradient(width / 2, height * 0.37, 10, width / 2, height * 0.4, Math.max(width, height) * 0.72);
      backdrop.addColorStop(0, corruption > 5 ? "#100b0a" : "#0d1210");
      backdrop.addColorStop(0.52, "#080a09");
      backdrop.addColorStop(1, "#050606");
      context.fillStyle = backdrop;
      context.fillRect(0, 0, width, height);

      context.strokeStyle = corruption >= 6 ? "rgba(183, 99, 90, .055)" : "rgba(135, 153, 140, .045)";
      context.lineWidth = 0.5;
      const gridSize = width < 680 ? 32 : 48;
      for (let x = gridSize; x < width; x += gridSize) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let y = gridSize; y < height; y += gridSize) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }

      context.globalAlpha = corruption > 1 ? 0.05 + corruption * 0.004 : 0.028;
      context.strokeStyle = corruption >= 6 ? "#b7635a" : "#d8d3c7";
      for (let y = 0; y < height; y += 4) {
        const offset = corruption > 5 && y % 36 === 0 ? Math.sin(time * 0.012 + y) * 5 : 0;
        context.beginPath();
        context.moveTo(0, y + offset);
        context.lineTo(width, y);
        context.stroke();
      }
      context.globalAlpha = 1;

      const ease = reducedMotion ? 0.28 : mood === "agitated" ? 0.16 : 0.085;
      gazeRef.current.x += (targetRef.current.x - gazeRef.current.x) * ease;
      gazeRef.current.y += (targetRef.current.y - gazeRef.current.y) * ease;
      const targetAwake = hidden ? 0 : mood === "dormant" ? (pointerSeenRef.current ? 1 : 0.035) : 1;
      awakeRef.current += (targetAwake - awakeRef.current) * (reducedMotion ? 0.3 : 0.075);

      if (!reducedMotion && time > nextBlinkRef.current) {
        blinkStartRef.current = time;
        nextBlinkRef.current = time + 3200 + ((Math.sin(time * 0.001) + 1) / 2) * 4300;
      }
      const blinkElapsed = time - blinkStartRef.current;
      const blink = blinkElapsed >= 0 && blinkElapsed < 190 ? Math.sin((blinkElapsed / 190) * Math.PI) : 0;
      const openness = clamp(awakeRef.current * (1 - blink * 0.96), 0.025, 1);

      const mobile = width < 680;
      const eyeWidth = mobile ? Math.min(148, width * 0.36) : Math.min(272, width * 0.205);
      const eyeHeight = eyeWidth * 0.31;
      const spacing = mobile ? eyeWidth * 0.64 : eyeWidth * 0.7;
      const centerY = mobile ? height * 0.29 : height * 0.39;
      const tremor = mood === "agitated" && !reducedMotion ? Math.sin(time * 0.028) * (0.8 + corruption * 0.15) : 0;

      const leftGaze = { x: gazeRef.current.x + tremor / 95, y: gazeRef.current.y };
      const rightDiversion = mood === "focused" || mood === "agitated" ? 0.2 + Math.sin(time * 0.0007) * 0.12 : 0;
      const rightGaze = {
        x: clamp(gazeRef.current.x + rightDiversion, -1, 1),
        y: clamp(gazeRef.current.y - rightDiversion * 0.36, -1, 1),
      };

      drawTerminalEye(context, { x: width / 2 - spacing, y: centerY + tremor }, { width: eyeWidth, height: eyeHeight }, leftGaze, openness, time, 0, corruption);
      drawTerminalEye(context, { x: width / 2 + spacing, y: centerY - tremor }, { width: eyeWidth, height: eyeHeight }, rightGaze, openness, time, 1, corruption);

      if (corruption >= 6 && !reducedMotion) {
        context.globalCompositeOperation = "difference";
        context.globalAlpha = 0.035 * corruption;
        context.fillStyle = "#7c393d";
        const bandY = (time * 0.08) % height;
        context.fillRect(0, bandY, width, 1 + corruption * 0.3);
        context.globalAlpha = 1;
        context.globalCompositeOperation = "source-over";
      }

      frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [corruption, hidden, mood]);

  return <canvas ref={canvasRef} className="eye-canvas" aria-hidden="true" />;
}
