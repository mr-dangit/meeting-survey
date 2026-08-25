import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, getSurvey, reviseSurvey, submitSurvey } from "../api";
import { RatingField } from "../components/RatingField";
import { SurveyReceipt } from "../components/SurveyReceipt";
import type { RatingQuestionId, SurveyAnswers, SurveyContext } from "../types";
import { validateSurvey, type ValidationErrors } from "../validation";

const prompts: Record<RatingQuestionId, string> = {
  usefulness: "To what extent did this meeting help you make progress toward your goals?",
  actionability: "How clear are your next steps after this meeting?",
  necessity: "How necessary was this meeting for you?"
};
// Each question labels its own stars. A shared "Not at all → A great deal" scale made three quite
// different questions read as one, and left the necessity question ambiguous: a low rating there
// means the meeting was avoidable, not that it went badly.
const scales: Record<RatingQuestionId, readonly string[]> = {
  usefulness: ["No progress", "A little progress", "Some progress", "Good progress", "Real progress"],
  actionability: ["Not clear at all", "Slightly clear", "Fairly clear", "Mostly clear", "Completely clear"],
  necessity: [
    "Could have read an update",
    "Mostly could have been an update",
    "Needed, but shorter or smaller",
    "Meeting was needed",
    "Meeting was definitely needed"
  ]
};
const ids = Object.keys(prompts) as RatingQuestionId[];
const commentLimit = 1000;
const initial: SurveyAnswers = { usefulness: null, actionability: null, necessity: null, comment: "" };

export function SurveyPage({ access }: { access: string }) {
  const [meeting, setMeeting] = useState<SurveyContext | null>(null);
  const [answers, setAnswers] = useState(initial);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [state, setState] = useState<"loading" | "ready" | "invalid" | "error" | "submitted">("loading");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  // Set once this visitor has filed a response. Its presence is what makes the next submit a
  // revision of that row rather than a second response. Held in memory only, so it never becomes a
  // stored link between this browser and the answers.
  const [responseId, setResponseId] = useState<string | null>(null);
  // Whether the visitor has gone back in to change an answer, so the form and receipt can say
  // "update" instead of "submit" rather than implying a second response is being filed.
  const [revised, setRevised] = useState(false);
  const refs = useRef<Partial<Record<RatingQuestionId, HTMLFieldSetElement>>>({});
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const commentRef = useRef<HTMLTextAreaElement | null>(null);

  // Moving to another survey link has to start from a clean form: without the reset the previous
  // meeting's answers and receipt stay on screen, and a late-resolving earlier fetch would
  // overwrite the newer meeting.
  useEffect(() => {
    let active = true;
    setState("loading");
    setAnswers(initial);
    setErrors({});
    setMessage("");
    setResponseId(null);
    setRevised(false);
    void getSurvey(access).then((result) => {
      if (!active) return;
      setMeeting(result);
      setState("ready");
    }).catch((reason) => {
      if (!active) return;
      setState(reason instanceof ApiError && reason.status === 404 ? "invalid" : "error");
      setMessage(reason instanceof Error ? reason.message : "The survey could not be loaded. Please try again.");
    });
    return () => { active = false; };
  }, [access]);

  // The note grows with what is typed rather than hiding earlier lines behind a two-row scroll.
  useEffect(() => {
    const node = commentRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [answers.comment, state]);

  function setRating(id: RatingQuestionId, value: number) {
    setAnswers((current) => ({ ...current, [id]: value }));
    // Answering is what fixes the error, so the message clears on the answer rather than waiting
    // for the next submit and leaving a stale complaint beside a filled-in question.
    setErrors((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateSurvey(answers);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      // Focus lands on the summary rather than the first bad field: it names every unanswered
      // question at once, and each entry moves focus on to the question it names.
      summaryRef.current?.focus();
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const result = responseId
        ? await reviseSurvey(access, responseId, answers)
        : await submitSurvey(access, answers);
      setResponseId(result.responseId);
      setState("submitted");
    } catch (reason) {
      setMessage(reason instanceof ApiError ? reason.message : "Feedback could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (state === "loading") return <main><p>Loading survey…</p></main>;
  if (state === "invalid") return <main><h1>This survey link is invalid.</h1></main>;
  if (state === "error") return <main><p role="alert">{message}</p></main>;
  if (state === "submitted" && meeting) return <SurveyReceipt meeting={meeting} answers={answers} revised={revised} onEdit={() => { setRevised(true); setState("ready"); }} />;
  if (!meeting) return <main><p>Loading survey…</p></main>;
  if (meeting.status === "closed") return <main><h1>This survey is closed.</h1></main>;

  const answered = ids.filter((id) => answers[id] !== null).length;
  const unanswered = ids.filter((id) => errors[id]);

  return <main className="content-wrap survey-layout" aria-labelledby="survey-heading">
    <section className="survey-column">
      <header className="intro-block">
        <p className="eyebrow">Anonymous meeting feedback</p>
        <h1 id="survey-heading">{meeting.title}</h1>
        <p className="meeting-meta">{formatMeetingContext(meeting)}</p>
      </header>
      <form className="survey-form" onSubmit={submit} noValidate>
        <div className="survey-progress">
          <p className="progress-label" aria-live="polite">{answered} of {ids.length} answered</p>
          <span className="progress-track" aria-hidden="true">
            <span className="progress-fill" style={{ width: `${(answered / ids.length) * 100}%` }} />
          </span>
        </div>
        {unanswered.length > 0 && <div className="error-summary" role="alert" tabIndex={-1} ref={summaryRef}>
          <strong>{unanswered.length === 1 ? "One question still needs a rating" : `${unanswered.length} questions still need a rating`}</strong>
          <ul>
            {unanswered.map((id) => <li key={id}>
              <button type="button" onClick={() => refs.current[id]?.focus()}>{prompts[id]}</button>
            </li>)}
          </ul>
        </div>}
        <div className="question-stack">
          {ids.map((id, position) => <RatingField key={id} id={id} prompt={prompts[id]} index={position + 1} total={ids.length}
            value={answers[id]} error={errors[id]}
            scaleWords={scales[id]}
            fieldRef={(node) => { if (node) refs.current[id] = node; }}
            onChange={(value) => setRating(id, value)} />)}
        </div>
        <div className="comment-field">
          <div className="comment-label-row"><label htmlFor="comment">Anything to improve?</label><span>Optional</span></div>
          <textarea id="comment" name="comment" ref={commentRef} rows={2} maxLength={commentLimit} value={answers.comment}
            onChange={(event) => setAnswers((current) => ({ ...current, comment: event.target.value }))}
            placeholder="One small suggestion" />
          <div className="comment-foot">
            <span className="privacy-note">Do not include names or confidential meeting content.</span>
            <span className={`char-count${answers.comment.length > commentLimit * 0.9 ? " is-near" : ""}`}>
              {answers.comment.length}/{commentLimit}
            </span>
          </div>
        </div>
        {errors.comment ? <p className="field-error" role="alert">{errors.comment}</p> : null}
        {message ? <p className="field-error" role="alert">{message}</p> : null}
        <div className="form-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving feedback…" : responseId ? "Update feedback" : "Submit feedback"} <span aria-hidden="true">→</span></button></div>
      </form>
    </section>
  </main>;
}

function formatMeetingContext(meeting: SurveyContext) {
  const date = new Date(meeting.meetingAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
  return `${date} · ${meeting.chairLabel}`;
}
