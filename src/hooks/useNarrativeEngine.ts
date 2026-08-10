import { useCallback, useEffect, useRef, useState } from "react";
import type { NarrativeContext, NarrativeLine, SceneDefinition } from "../types";
import { audioEngine } from "../lib/audioEngine";
import { gameClock } from "../lib/gameClock";

type RenderedLine = NarrativeLine & { id: string };

export function useNarrativeEngine(scene: SceneDefinition, context: NarrativeContext, paused = false) {
  const [history, setHistory] = useState<RenderedLine[]>([]);
  const [currentlyTyping, setCurrentlyTyping] = useState("");
  const [currentTone, setCurrentTone] = useState<NarrativeLine["tone"]>("entity");
  const [complete, setComplete] = useState(false);
  const skipRequested = useRef(false);

  const skipLine = useCallback(() => {
    skipRequested.current = true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    skipRequested.current = false;
    setHistory([]);
    setCurrentlyTyping("");
    setComplete(false);
    if (paused) return () => { cancelled = true; };

    const play = async () => {
      const lines = scene.lines(context);

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        if (cancelled) return;
        const line = lines[lineIndex];
        const characters = Array.from(line.text);
        setCurrentTone(line.tone ?? "entity");
        setCurrentlyTyping("");

        for (let characterIndex = 0; characterIndex < characters.length; characterIndex += 1) {
          if (cancelled) return;
          if (skipRequested.current) {
            skipRequested.current = false;
            setCurrentlyTyping(line.text);
            break;
          }

          const partial = characters.slice(0, characterIndex + 1).join("");
          setCurrentlyTyping(partial);
          const character = characters[characterIndex];
          audioEngine.typeCharacter(character, line.tone, characterIndex);
          const punctuationPause = /[.!?]/.test(character) ? 105 : /[,;:]/.test(character) ? 48 : 0;
          const cadence = 0.72 + ((characterIndex * 17 + lineIndex * 13) % 9) / 25;
          await gameClock.wait((line.speed ?? 31) * cadence + punctuationPause);
        }

        if (cancelled) return;
        setCurrentlyTyping("");
        setHistory((previous) => [
          ...previous.slice(-4),
          { ...line, id: `${scene.id}-${lineIndex}` },
        ]);
        audioEngine.line(line.tone);
        await gameClock.wait(line.pauseAfter ?? 700);
      }

      if (!cancelled) setComplete(true);
    };

    void play();
    return () => {
      cancelled = true;
    };
    // Context is intentionally captured when a scene begins. Signal collection finishes before scene changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, scene.id]);

  return {
    history,
    currentlyTyping,
    currentTone,
    complete,
    skipLine,
  };
}
