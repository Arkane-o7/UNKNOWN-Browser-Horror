import type { NarrativeLine, SceneChoice } from "../types";

interface TerminalDialogueProps {
  history: Array<NarrativeLine & { id: string }>;
  currentlyTyping: string;
  tone?: NarrativeLine["tone"];
  complete: boolean;
  choices: SceneChoice[];
  pending: boolean;
  onChoice: (choiceId: string) => void;
  onSkip: () => void;
}

export function TerminalDialogue({
  history,
  currentlyTyping,
  tone,
  complete,
  choices,
  pending,
  onChoice,
  onSkip,
}: TerminalDialogueProps) {
  return (
    <section className="dialogue-dock" aria-label="Entity dialogue">
      <div className="dialogue-lines" aria-live="polite" aria-atomic="false" onClick={onSkip}>
        {history.slice(-3).map((line, index, visibleLines) => (
          <p
            className={`dialogue-line dialogue-line--past dialogue-line--${line.tone ?? "entity"}`}
            style={{ opacity: (index + 1) / (visibleLines.length + 1) }}
            key={line.id}
          >
            {line.text}
          </p>
        ))}
        {currentlyTyping && (
          <p className={`dialogue-line dialogue-line--current dialogue-line--${tone ?? "entity"}`}>
            {currentlyTyping}
            <span className="typing-caret" aria-hidden="true" />
          </p>
        )}
      </div>

      {complete && choices.length > 0 && (
        <div className="choice-row" aria-label="Available choices">
          {choices.map((choice) => (
            <button
              className={`choice-button${choice.quiet ? " choice-button--quiet" : ""}`}
              disabled={pending}
              key={choice.id}
              onClick={() => onChoice(choice.id)}
              type="button"
            >
              <span aria-hidden="true">[</span> {pending ? "OBSERVING" : choice.label} <span aria-hidden="true">]</span>
            </button>
          ))}
        </div>
      )}
      {!complete && currentlyTyping && (
        <button className="skip-line" type="button" onClick={onSkip} aria-label="Reveal current line">
          reveal line
        </button>
      )}
    </section>
  );
}
