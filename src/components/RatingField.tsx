import { useState, type Ref } from "react";
import type { RatingQuestionId } from "../types";

type Props = {
  id: RatingQuestionId;
  prompt: string;
  index: number;
  total: number;
  value: number | null;
  error?: string;
  // One phrase per star, lowest first. Each question words its own scale, because "3 out of 5"
  // means something different for progress made than it does for whether the meeting was needed.
  scaleWords: readonly string[];
  onChange: (value: number) => void;
  fieldRef?: Ref<HTMLFieldSetElement>;
};

export function RatingField({
  id,
  prompt,
  index,
  total,
  value,
  error,
  scaleWords,
  onChange,
  fieldRef
}: Props) {
  // Previewing the hovered rating is what makes a five-star row legible: without it the only signal
  // is the pointer position, and nothing shows what clicking would actually record.
  const [hovered, setHovered] = useState<number | null>(null);
  const shown = hovered ?? value ?? 0;

  return (
    <fieldset
      className={`rating-question${error ? " has-error" : ""}`}
      ref={fieldRef}
      tabIndex={-1}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${id}-error` : undefined}
    >
      <legend>
        <span className="question-index" aria-hidden="true">{index} / {total}</span>
        <span className="question-prompt">{prompt}</span>
      </legend>
      <div
        className="rating-control"
        role="radiogroup"
        aria-label={prompt}
        onMouseLeave={() => setHovered(null)}
      >
        {[1, 2, 3, 4, 5].map((rating) => (
          <div className="rating-option" key={rating}>
            <input
              id={`${id}-${rating}`}
              type="radio"
              name={id}
              value={rating}
              checked={value === rating}
              onChange={() => onChange(rating)}
              aria-label={`${prompt} — ${rating} out of 5, ${scaleWords[rating - 1]}`}
            />
            <label
              htmlFor={`${id}-${rating}`}
              className={value === rating ? "is-selected" : undefined}
              onMouseEnter={() => setHovered(rating)}
            >
              <span
                className={`star-symbol ${rating <= shown ? "is-filled" : "is-outline"}${hovered === null ? "" : " is-preview"}`}
                aria-hidden="true"
              >
                {rating <= shown ? "★" : "☆"}
              </span>
            </label>
          </div>
        ))}
      </div>
      {/* The readout keeps its height whether or not a rating is showing, so pointing along the row
          never nudges the questions below it. */}
      <p className={`rating-readout${shown ? "" : " is-empty"}`} aria-hidden="true">
        {shown ? scaleWords[shown - 1] : "Pick a rating"}
      </p>
      {/* The readout above tracks the pointer, so the committed answer is announced from here
          instead — a hover-driven live region would narrate ratings nobody chose. */}
      <span className="sr-only" aria-live="polite">
        {value === null ? "" : `${prompt}: ${value} out of 5, ${scaleWords[value - 1]}`}
      </span>
      {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
    </fieldset>
  );
}
