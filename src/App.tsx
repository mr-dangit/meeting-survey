import { useRef, useState, type FormEvent, type MutableRefObject } from "react";
import { meetingQuestions, ratingOptions, reportData } from "./data";
import type { RatingQuestionId, SurveyAnswers } from "./types";
import { validateSurvey, type ValidationErrors } from "./validation";

const ratingQuestionIds: RatingQuestionId[] = [
  "usefulness",
  "actionability",
  "reInvite"
];

const initialAnswers = (): SurveyAnswers => ({
  usefulness: null,
  actionability: null,
  reInvite: null,
  comment: ""
});

type Mode = "attendee" | "report";

function App() {
  const [mode, setMode] = useState<Mode>("attendee");
  const [answers, setAnswers] = useState<SurveyAnswers>(initialAnswers);
  const [submittedAnswers, setSubmittedAnswers] = useState<SurveyAnswers | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const fieldRefs = useRef<Partial<Record<RatingQuestionId, HTMLFieldSetElement>>>({});

  const handleRatingChange = (questionId: RatingQuestionId, value: number) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setErrors((current) => {
      if (!current[questionId]) return current;
      const next = { ...current };
      delete next[questionId];
      return next;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateSurvey(answers);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      const firstInvalidId = ratingQuestionIds.find((questionId) => nextErrors[questionId]);
      if (firstInvalidId) {
        fieldRefs.current[firstInvalidId]?.focus();
      }
      return;
    }

    setSubmittedAnswers({ ...answers });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="wordmark" aria-label="Dymon meeting feedback prototype">
          <span className="wordmark-name">Dymon</span>
          <span className="wordmark-divider" aria-hidden="true">/</span>
          <span className="wordmark-context">Meeting feedback</span>
        </div>
        <div className="topbar-actions">
          <span className="prototype-label">Internal prototype</span>
          <button
            className="mode-switch"
            type="button"
            aria-label={mode === "attendee" ? "Chair report" : "Attendee survey"}
            onClick={() => setMode(mode === "attendee" ? "report" : "attendee")}
          >
            {mode === "attendee" ? "Chair report" : "Attendee survey"}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </header>

      <div className="page-rule" aria-hidden="true" />

      {mode === "attendee" ? (
        submittedAnswers ? (
          <Receipt answers={submittedAnswers} onEdit={() => setSubmittedAnswers(null)} />
        ) : (
          <SurveyForm
            answers={answers}
            errors={errors}
            fieldRefs={fieldRefs}
            onRatingChange={handleRatingChange}
            onCommentChange={(comment) => setAnswers((current) => ({ ...current, comment }))}
            onSubmit={handleSubmit}
          />
        )
      ) : (
        <ChairReport />
      )}

      <footer className="site-footer">
        <span>Meeting feedback prototype</span>
        <span>Anonymous by design · Demo only</span>
      </footer>
    </div>
  );
}

type SurveyFormProps = {
  answers: SurveyAnswers;
  errors: ValidationErrors;
  fieldRefs: MutableRefObject<Partial<Record<RatingQuestionId, HTMLFieldSetElement>>>;
  onRatingChange: (questionId: RatingQuestionId, value: number) => void;
  onCommentChange: (comment: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function SurveyForm({
  answers,
  errors,
  fieldRefs,
  onRatingChange,
  onCommentChange,
  onSubmit
}: SurveyFormProps) {
  return (
    <main className="content-wrap survey-layout">
      <section className="survey-column" aria-labelledby="survey-heading">
        <div className="intro-block">
          <p className="eyebrow">Post-meeting check-in</p>
          <h1 id="survey-heading">Share your perspective</h1>
          <p className="intro-copy">
            A few thoughtful answers help us keep meetings focused, useful, and worth your time.
          </p>
        </div>

        <section className="meeting-context" aria-label="Meeting context">
          <div>
            <p className="context-label">You are responding to</p>
            <h2>Title of the meeting</h2>
            <p className="context-meta">Meeting date · Meeting chair</p>
          </div>
          <span className="context-status">Open</span>
        </section>

        <aside className="anonymous-notice" role="note">
          <span className="notice-icon" aria-hidden="true">◎</span>
          <div>
            <strong>Your feedback is anonymous</strong>
            <p>Your answers are shared in aggregate. We do not attach your name to this response.</p>
          </div>
        </aside>

        <form className="survey-form" onSubmit={onSubmit} noValidate>
          <div className="form-heading-row">
            <div>
              <p className="eyebrow">Three quick ratings</p>
              <h2>Tell us how it felt</h2>
            </div>
            <span className="required-note"><span aria-hidden="true">*</span> Required</span>
          </div>

          <div className="question-stack">
            {meetingQuestions.map((question, questionIndex) => {
              const error = errors[question.id];
              const helperId = `${question.id}-helper`;
              const errorId = `${question.id}-error`;
              return (
                <fieldset
                  className={`rating-question${error ? " has-error" : ""}`}
                  key={question.id}
                  ref={(element) => {
                    if (element) fieldRefs.current[question.id] = element;
                  }}
                  tabIndex={-1}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `${helperId} ${errorId}` : helperId}
                >
                  <legend>
                    <span className="question-number">0{questionIndex + 1}</span>
                    <span>{question.prompt}</span>
                  </legend>
                  <p className="question-helper" id={helperId}>{question.helper}</p>
                  <div className="rating-control" role="radiogroup" aria-label={question.prompt}>
                    {ratingOptions.map((rating) => {
                      const inputId = `${question.id}-${rating}`;
                      return (
                        <div className="rating-option" key={rating}>
                          <input
                            id={inputId}
                            type="radio"
                            name={question.id}
                            value={rating}
                            checked={answers[question.id] === rating}
                            onChange={() => onRatingChange(question.id, rating)}
                            aria-label={`${question.prompt} — ${rating} out of 5`}
                          />
                          <label htmlFor={inputId}>
                            <span className="star-symbol" aria-hidden="true">★</span>
                            <span className="rating-number">{rating}</span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                  <div className="scale-labels" aria-hidden="true">
                    <span>Not at all</span>
                    <span>Very much</span>
                  </div>
                  {error ? <p className="field-error" id={errorId} role="alert">{error}</p> : null}
                </fieldset>
              );
            })}
          </div>

          <div className="comment-field">
            <div className="comment-label-row">
              <label htmlFor="comment">What is one thing that would make this meeting more valuable?</label>
              <span>Optional</span>
            </div>
            <textarea
              id="comment"
              name="comment"
              rows={4}
              value={answers.comment}
              onChange={(event) => onCommentChange(event.target.value)}
              placeholder="Share a small improvement, a sharper question, or something to keep."
            />
          </div>

          <div className="form-actions">
            <button className="primary-button" type="submit">
              Submit feedback
              <span aria-hidden="true">→</span>
            </button>
            <p>By submitting, you are sharing an anonymous response for meeting improvement.</p>
          </div>
        </form>
      </section>

      <aside className="side-panel" aria-label="About this survey">
        <div className="side-panel-intro">
          <p className="eyebrow">Why we ask</p>
          <h2>Better meetings are built from honest signals.</h2>
          <p>Use the scale to capture the overall experience, then leave one practical suggestion if you have one.</p>
        </div>
        <div className="side-panel-list">
          <div className="side-panel-item">
            <span>01</span>
            <div><strong>Be direct</strong><p>There is no right answer.</p></div>
          </div>
          <div className="side-panel-item">
            <span>02</span>
            <div><strong>Keep it useful</strong><p>One clear thought is enough.</p></div>
          </div>
          <div className="side-panel-item">
            <span>03</span>
            <div><strong>Stay anonymous</strong><p>Responses are reviewed in aggregate.</p></div>
          </div>
        </div>
        <div className="side-panel-footer">Usually takes less than 60 seconds.</div>
      </aside>
    </main>
  );
}

type ReceiptProps = {
  answers: SurveyAnswers;
  onEdit: () => void;
};

function Receipt({ answers, onEdit }: ReceiptProps) {
  return (
    <main className="content-wrap receipt-layout" aria-labelledby="receipt-heading">
      <section className="receipt-card">
        <div className="receipt-topline">
          <span className="success-mark" aria-hidden="true">✓</span>
          <span className="eyebrow">Recorded anonymously</span>
        </div>
        <h1 id="receipt-heading">Feedback received</h1>
        <p className="receipt-copy">Thank you for taking a moment to help make the next meeting more valuable.</p>

        <section className="receipt-context" aria-label="Submitted meeting context">
          <span>Title of the meeting</span>
          <strong>Meeting date · Meeting chair</strong>
        </section>

        <div className="receipt-answers" aria-label="Your submitted answers">
          {meetingQuestions.map((question) => (
            <div className="receipt-answer" key={question.id}>
              <span>{question.prompt}</span>
              <strong>{answers[question.id]} / 5</strong>
            </div>
          ))}
        </div>

        <div className="receipt-comment">
          <span className="comment-heading">Your optional note</span>
          <p>{answers.comment.trim() || "No comment added."}</p>
        </div>

        <div className="receipt-actions">
          <button className="secondary-button" type="button" onClick={onEdit}>Edit response</button>
          <span>Only you can see this receipt.</span>
        </div>
      </section>
    </main>
  );
}

function ChairReport() {
  return (
    <main className="content-wrap report-layout" aria-labelledby="report-heading">
      <section className="report-intro">
        <div>
          <p className="eyebrow">Demo data · 24 responses</p>
          <h1 id="report-heading">Chair report</h1>
          <p className="intro-copy">A quick read on how the meeting landed, with anonymous comments to guide the next one.</p>
        </div>
        <span className="demo-badge">Prototype view</span>
      </section>

      <section className="report-metrics" aria-label="Meeting overview">
        <div className="report-metric report-metric-featured">
          <span>Meeting Value Score</span>
          <strong>{reportData.valueScore.toFixed(1)}<small> / 5</small></strong>
          <p>Overall usefulness across all three questions.</p>
        </div>
        <div className="report-metric">
          <span>Response rate</span>
          <strong>{reportData.responseRate}<small>%</small></strong>
          <p>{reportData.respondents} of {reportData.invitees} invited attendees.</p>
        </div>
        <div className="report-metric">
          <span>Signal</span>
          <strong>Strong</strong>
          <p>Most responses sit at 4 or 5.</p>
        </div>
      </section>

      <div className="report-body-grid">
        <section className="report-section" aria-labelledby="averages-heading">
          <div className="section-heading-row">
            <div><p className="eyebrow">Question averages</p><h2 id="averages-heading">What stood out</h2></div>
            <span className="section-count">3 questions</span>
          </div>
          <div className="average-list">
            {reportData.questions.map((question, index) => (
              <div className="average-row" key={question.id}>
                <div className="average-row-topline"><span>0{index + 1}</span><strong>{question.average.toFixed(1)} / 5</strong></div>
                <p>{question.prompt}</p>
                <div className="average-track" aria-label={`${question.average.toFixed(1)} out of 5 average`}><span style={{ width: `${question.average * 20}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        <section className="report-section comments-section" aria-labelledby="comments-heading">
          <div className="section-heading-row">
            <div><p className="eyebrow">Anonymous comments</p><h2 id="comments-heading">What people said</h2></div>
            <span className="section-count">3 notes</span>
          </div>
          <div className="comment-list">
            {reportData.comments.map((comment) => <blockquote key={comment}>{comment}</blockquote>)}
          </div>
        </section>
      </div>

      <section className="distribution-section report-section" aria-labelledby="distribution-heading">
        <div className="section-heading-row">
          <div><p className="eyebrow">Response distribution</p><h2 id="distribution-heading">A fuller picture</h2></div>
          <span className="section-count">Scale of 1 to 5</span>
        </div>
        <div className="distribution-grid">
          {reportData.questions.map((question) => (
            <div className="distribution-card" key={question.id}>
              <p>{question.prompt}</p>
              <div className="distribution-bars">
                {question.distribution.map((point) => (
                  <div className="distribution-bar-wrap" key={point.rating}>
                    <span className="distribution-count">{point.count}</span>
                    <div className="distribution-bar-track" aria-hidden="true"><span style={{ height: `${Math.max(point.percentage, 4)}%` }} /></div>
                    <span className="distribution-label">{point.rating}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
