import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, getSurvey, submitSurvey } from "../api";
import { RatingField } from "../components/RatingField";
import { SurveyReceipt } from "../components/SurveyReceipt";
import type { RatingQuestionId, SurveyAnswers, SurveyContext } from "../types";
import { validateSurvey, type ValidationErrors } from "../validation";

const prompts: Record<RatingQuestionId, string> = {
  usefulness: "How useful was this meeting in helping you achieve your goals?",
  actionability: "Did you leave with actionable ideas or clear follow-up tasks?",
  reInvite: "Would you want to be invited to this meeting again?"
};
const ids = Object.keys(prompts) as RatingQuestionId[];
const initial: SurveyAnswers = { usefulness: null, actionability: null, reInvite: null, comment: "" };

export function SurveyPage({ access }: { access: string }) {
  const [meeting, setMeeting] = useState<SurveyContext | null>(null);
  const [answers, setAnswers] = useState(initial);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [state, setState] = useState<"loading" | "ready" | "invalid" | "error" | "submitted">("loading");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const refs = useRef<Partial<Record<RatingQuestionId, HTMLFieldSetElement>>>({});

  useEffect(() => {
    void getSurvey(access).then((result) => {
      setMeeting(result);
      setState("ready");
    }).catch((reason) => {
      setState(reason instanceof ApiError && reason.status === 404 ? "invalid" : "error");
      setMessage(reason instanceof Error ? reason.message : "The survey could not be loaded. Please try again.");
    });
  }, [access]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateSurvey(answers);
    setErrors(nextErrors);
    const first = ids.find((id) => nextErrors[id]);
    if (first) {
      refs.current[first]?.focus();
      return;
    }
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    setMessage("");
    try {
      await submitSurvey(access, answers);
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
  if (state === "submitted" && meeting) return <SurveyReceipt meeting={meeting} answers={answers} onEdit={() => setState("ready")} />;
  if (meeting?.status === "closed") return <main><h1>This survey is closed.</h1></main>;

  return <main className="content-wrap survey-layout" aria-labelledby="survey-heading">
    <section className="survey-column">
      <div className="intro-block">
        <p className="eyebrow">Anonymous meeting feedback</p>
        <h1 id="survey-heading">Meeting feedback</h1>
        <p className="intro-copy">Help the chair understand what was useful and what would make the next meeting more valuable.</p>
      </div>
      {meeting && <section className="meeting-context" aria-label="Meeting context">
        <div><span className="context-label">Title of the meeting</span><h2>{meeting.title}</h2></div>
        <span className="context-meta">{formatMeetingContext(meeting)}</span>
      </section>}
      <aside className="anonymous-notice" role="note">
        <strong>Anonymous feedback</strong><span>Shared in aggregate only.</span>
      </aside>
      <form className="survey-form" onSubmit={submit} noValidate>
        <div className="question-stack">
          {ids.map((id) => <RatingField key={id} id={id} prompt={prompts[id]} value={answers[id]} error={errors[id]}
            fieldRef={(node) => { if (node) refs.current[id] = node; }}
            onChange={(value) => setAnswers((current) => ({ ...current, [id]: value }))} />)}
        </div>
        <div className="comment-field">
          <div className="comment-label-row"><label htmlFor="comment">Anything to improve?</label><span>Optional</span></div>
          <textarea id="comment" name="comment" rows={2} maxLength={1000} value={answers.comment}
            onChange={(event) => setAnswers((current) => ({ ...current, comment: event.target.value }))}
            placeholder="One small suggestion" />
        </div>
        <p className="privacy-note">Do not include names or confidential meeting content.</p>
        {errors.comment ? <p className="field-error" role="alert">{errors.comment}</p> : null}
        {message ? <p className="field-error" role="alert">{message}</p> : null}
        <div className="form-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving feedback…" : "Submit feedback"} <span aria-hidden="true">→</span></button></div>
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
