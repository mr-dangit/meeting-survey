import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, getSurvey, submitSurvey } from "../api";
import { RatingField } from "../components/RatingField";
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
  const [state, setState] = useState<"loading" | "ready" | "invalid" | "submitted">("loading");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const refs = useRef<Partial<Record<RatingQuestionId, HTMLFieldSetElement>>>({});

  useEffect(() => {
    void getSurvey(access).then((result) => { setMeeting(result); setState("ready"); })
      .catch((reason) => { setState(reason instanceof ApiError && reason.status === 404 ? "invalid" : "ready"); setMessage(reason.message); });
  }, [access]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateSurvey(answers);
    setErrors(nextErrors);
    const first = ids.find((id) => nextErrors[id]);
    if (first) { refs.current[first]?.focus(); return; }
    if (Object.keys(nextErrors).length) return;
    setSaving(true); setMessage("");
    try {
      await submitSurvey(access, answers);
      setState("submitted");
    } catch (reason) {
      setMessage(reason instanceof ApiError ? reason.message : "Feedback could not be saved. Please try again.");
    } finally { setSaving(false); }
  }

  if (state === "loading") return <main><p>Loading survey…</p></main>;
  if (state === "invalid") return <main><h1>This survey link is invalid.</h1></main>;
  if (state === "submitted") return <main><h1>Feedback received</h1><p>Your response was stored anonymously.</p></main>;
  if (meeting?.status === "closed") return <main><h1>This survey is closed.</h1></main>;

  return <main className="survey-layout"><h1>{meeting?.title ?? "Meeting feedback"}</h1>
    {meeting && <p>{meeting.chairLabel} · {new Date(meeting.meetingAt).toLocaleString()}</p>}
    <form onSubmit={submit}>{ids.map((id) => <RatingField key={id} id={id} prompt={prompts[id]}
      value={answers[id]} error={errors[id]} fieldRef={(node) => { if (node) refs.current[id] = node; }}
      onChange={(value) => setAnswers((current) => ({ ...current, [id]: value }))} />)}
      <label>Optional comment<textarea maxLength={1001} value={answers.comment}
        onChange={(event) => setAnswers((current) => ({ ...current, comment: event.target.value }))} /></label>
      <p>Do not include names or confidential meeting content. Your wording or context may still identify you.</p>
      {errors.comment && <p role="alert">{errors.comment}</p>}{message && <p role="alert">{message}</p>}
      <button type="submit" disabled={saving}>{saving ? "Saving feedback…" : "Submit feedback"}</button>
    </form>
  </main>;
}
