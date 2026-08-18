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
    <fieldset className="rating-question" ref={fieldRef} tabIndex={-1} aria-describedby={error ? `${id}-error` : undefined}>
      <legend>{prompt}</legend>
      <div className="rating-control">
        {[1, 2, 3, 4, 5].map((rating) => (
          <label key={rating}>
            <input
              type="radio"
              name={id}
              value={rating}
              checked={value === rating}
              onChange={() => onChange(rating)}
            />
            {rating}
          </label>
        ))}
      </div>
      {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
    </fieldset>
  );
}
