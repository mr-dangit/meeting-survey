import type { Ref } from "react";
import type { RatingQuestionId } from "../types";

type Props = {
  id: RatingQuestionId;
  prompt: string;
  value: number | null;
  error?: string;
  onChange: (value: number) => void;
  fieldRef?: Ref<HTMLFieldSetElement>;
};

export function RatingField({ id, prompt, value, error, onChange, fieldRef }: Props) {
  return (
    <fieldset className={`rating-question${error ? " has-error" : ""}`} ref={fieldRef} tabIndex={-1} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}>
      <legend>{prompt}</legend>
      <div className="rating-control" role="radiogroup" aria-label={prompt}>
        {[1, 2, 3, 4, 5].map((rating) => (
          <div className="rating-option" key={rating}>
            <input
              id={`${id}-${rating}`}
              type="radio"
              name={id}
              value={rating}
              checked={value === rating}
              onChange={() => onChange(rating)}
              aria-label={`${prompt} — ${rating} out of 5`}
            />
            <label htmlFor={`${id}-${rating}`}>
              <span className={`star-symbol ${rating <= (value ?? 0) ? "is-filled" : "is-outline"}`} aria-hidden="true">
                {rating <= (value ?? 0) ? "★" : "☆"}
              </span>
            </label>
          </div>
        ))}
      </div>
      {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
    </fieldset>
  );
}
