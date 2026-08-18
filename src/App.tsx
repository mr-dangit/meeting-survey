import { useRef, useState, type FormEvent, type MutableRefObject } from "react";
import { meetingQuestions, ratingOptions, reportData, seriesOccurrences } from "./data";
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

type Mode = "attendee" | "report" | "series";

function App() {
  const [mode] = useState<Mode>(() => {
    const requestedView = new URLSearchParams(window.location.search).get("view");
    return requestedView === "report" || requestedView === "series" ? requestedView : "attendee";
  });
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
        <img
          className="dymon-logo"
          src="/dymon-asia-logo.png"
          alt="Dymon Asia Capital"
        />
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
      ) : mode === "report" ? (
        <ChairReport />
      ) : (
        <SeriesDashboard />
      )}

    </div>
  );
}

function SeriesDashboard() {
  const latest = seriesOccurrences.at(-1)!;
  const previous = seriesOccurrences.at(-2)!;
  const recent = seriesOccurrences.slice(-3);
  const rollingAverage = recent.reduce((sum, meeting) => sum + meeting.valueScore, 0) / recent.length;
  const questionLabels: Record<RatingQuestionId, string> = {
    usefulness: "Useful and relevant",
    actionability: "Clear next actions",
    reInvite: "Would attend again"
  };

  return (
    <main className="content-wrap series-layout" aria-labelledby="series-heading">
      <section className="series-hero">
        <div>
          <p className="eyebrow">Meeting series · Fictional demo data</p>
          <h1 id="series-heading">Investment Committee</h1>
          <p className="series-subtitle">Six-meeting history</p>
        </div>
        <div className="series-period"><span>Reporting period</span><strong>Mar — Aug 2026</strong></div>
      </section>

      <section className="series-kpis" aria-label="Latest meeting summary">
        <article className="series-kpi series-kpi-featured">
          <span>Latest value score</span>
          <strong>{latest.valueScore.toFixed(1)}<small> / 5</small></strong>
          <p className="positive-change">+{(latest.valueScore - previous.valueScore).toFixed(1)} vs previous</p>
        </article>
        <article className="series-kpi">
          <span>Rolling 3-meeting average</span>
          <strong>{rollingAverage.toFixed(1)}<small> / 5</small></strong>
          <p>Stable upward trajectory</p>
        </article>
        <article className="series-kpi">
          <span>Latest response rate</span>
          <strong>{latest.responseRate}<small>%</small></strong>
          <p>{latest.respondents} of {latest.invitees} invited attendees</p>
        </article>
      </section>

      <section className="series-panel value-trend-panel" aria-labelledby="value-trend-heading">
        <div className="series-section-heading">
          <div><p className="eyebrow">Meeting Value Score</p><h2 id="value-trend-heading">Value over time</h2></div>
          <div className="trend-legend"><span /><span>Occurrence score</span><i /><span>3-meeting average</span></div>
        </div>
        <svg className="value-chart" viewBox="0 0 900 240" role="img" aria-label="Meeting Value Score rose from 3.7 in March to 4.2 in August">
          {[3.5, 4, 4.5, 5].map((tick) => <g key={tick}><line x1="48" x2="875" y1={210 - (tick - 3.5) * 120} y2={210 - (tick - 3.5) * 120} /><text x="8" y={215 - (tick - 3.5) * 120}>{tick.toFixed(1)}</text></g>)}
          <polyline className="score-line" points={seriesOccurrences.map((meeting, index) => `${70 + index * 158},${210 - (meeting.valueScore - 3.5) * 120}`).join(" ")} />
          <polyline className="rolling-line" points={seriesOccurrences.slice(2).map((_, index) => {
            const window = seriesOccurrences.slice(index, index + 3);
            const average = window.reduce((sum, meeting) => sum + meeting.valueScore, 0) / 3;
            return `${386 + index * 158},${210 - (average - 3.5) * 120}`;
          }).join(" ")} />
          {seriesOccurrences.map((meeting, index) => <g key={meeting.id}><circle cx={70 + index * 158} cy={210 - (meeting.valueScore - 3.5) * 120} r="5" /><text className="chart-date" x={70 + index * 158} y="235" textAnchor="middle">{meeting.shortDate}</text></g>)}
        </svg>
      </section>

      <div className="series-grid">
        <section className="series-panel" aria-labelledby="question-trends-heading">
          <div className="series-section-heading"><div><p className="eyebrow">Survey measures</p><h2 id="question-trends-heading">Question trends</h2></div><span className="section-count">Latest / 5</span></div>
          <div className="question-trends">
            {ratingQuestionIds.map((questionId) => (
              <div className="question-trend-row" key={questionId}>
                <div><span>{questionLabels[questionId]}</span><strong>{latest.questions[questionId].toFixed(1)}</strong></div>
                <svg viewBox="0 0 360 54" role="img" aria-label={`${questionLabels[questionId]} trend ending at ${latest.questions[questionId].toFixed(1)} out of 5`}>
                  <polyline points={seriesOccurrences.map((meeting, index) => `${8 + index * 68},${48 - (meeting.questions[questionId] - 3.4) * 38}`).join(" ")} />
                  {seriesOccurrences.map((meeting, index) => <circle key={meeting.id} cx={8 + index * 68} cy={48 - (meeting.questions[questionId] - 3.4) * 38} r="3" />)}
                </svg>
              </div>
            ))}
          </div>
        </section>

        <section className="series-panel" aria-labelledby="response-heading">
          <div className="series-section-heading"><div><p className="eyebrow">Participation</p><h2 id="response-heading">Response count &amp; rate</h2></div></div>
          <div className="response-bars">
            {seriesOccurrences.map((meeting) => (
              <div className="response-bar" key={meeting.id}>
                <div className="response-bar-track"><span style={{ height: `${meeting.responseRate}%` }}><b>{meeting.responseRate}%</b></span></div>
                <strong>{meeting.respondents}</strong>
                <small>{meeting.shortDate}</small>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="history-section" aria-labelledby="history-heading">
        <div className="series-section-heading"><div><p className="eyebrow">Occurrence archive</p><h2 id="history-heading">Meeting history</h2></div><span className="section-count">6 occurrences</span></div>
        <div className="history-table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Chair</th><th>Value score</th><th>Responses</th><th>Rate</th><th><span className="sr-only">Detailed report</span></th></tr></thead>
            <tbody>
              {[...seriesOccurrences].reverse().map((meeting, index) => (
                <tr key={meeting.id}>
                  <td><strong>{meeting.dateLabel}</strong>{index === 0 ? <span className="latest-label">Latest</span> : null}</td>
                  <td>{meeting.chair}</td><td>{meeting.valueScore.toFixed(1)} / 5</td><td>{meeting.respondents} / {meeting.invitees}</td><td>{meeting.responseRate}%</td>
                  <td><a href={`/?view=report&occurrence=${meeting.id}`}>View {meeting.shortDate} report <span aria-hidden="true">→</span></a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
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
          <h1 id="survey-heading">Meeting feedback</h1>
          <p className="intro-copy">
            <strong>Title of the meeting</strong>
            <span>Meeting date · Meeting chair</span>
          </p>
        </div>

        <aside className="anonymous-notice" role="note">
          <strong>Anonymous feedback</strong>
          <span>Shared in aggregate only.</span>
        </aside>

        <form className="survey-form" onSubmit={onSubmit} noValidate>
          <div className="question-stack">
            {meetingQuestions.map((question) => {
              const error = errors[question.id];
              const errorId = `${question.id}-error`;
              const selectedRating = answers[question.id] ?? 0;
              return (
                <fieldset
                  className={`rating-question${error ? " has-error" : ""}`}
                  key={question.id}
                  ref={(element) => {
                    if (element) fieldRefs.current[question.id] = element;
                  }}
                  tabIndex={-1}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : undefined}
                >
                  <legend>
                    <span>{question.prompt}</span>
                  </legend>
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
                            <span className={`star-symbol ${rating <= selectedRating ? "is-filled" : "is-outline"}`} aria-hidden="true">
                              {rating <= selectedRating ? "★" : "☆"}
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                  {error ? <p className="field-error" id={errorId} role="alert">{error}</p> : null}
                </fieldset>
              );
            })}
          </div>

          <div className="comment-field">
            <div className="comment-label-row">
              <label htmlFor="comment">Anything to improve?</label>
              <span>Optional</span>
            </div>
            <textarea
              id="comment"
              name="comment"
              rows={2}
              value={answers.comment}
              onChange={(event) => onCommentChange(event.target.value)}
              aria-label="What is one thing that would make this meeting more valuable?"
              placeholder="One small suggestion"
            />
          </div>

          <div className="form-actions">
            <button className="primary-button" type="submit">
              Submit feedback
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>
      </section>
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
  const highestRatedQuestion = reportData.questions.reduce((highest, question) => (
    question.average > highest.average ? question : highest
  ), reportData.questions[0]);

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

      <section className="report-overview" aria-label="Meeting overview">
        <div className="overview-score">
          <span>Meeting Value Score</span>
          <strong>{reportData.valueScore.toFixed(1)}<small> / 5</small></strong>
          <div className="overview-track" aria-label={`${reportData.valueScore.toFixed(1)} out of 5 overall score`}>
            <span style={{ width: `${reportData.valueScore * 20}%` }} />
          </div>
          <p>Overall usefulness across all three questions.</p>
        </div>
        <div className="overview-facts">
          <div className="overview-fact">
            <span>Response rate</span>
            <strong>{reportData.responseRate}%</strong>
            <p>{reportData.respondents} of {reportData.invitees} attendees</p>
          </div>
          <div className="overview-fact">
            <span>Highest score</span>
            <strong>{highestRatedQuestion.average.toFixed(1)} / 5</strong>
            <p>Would be invited again</p>
          </div>
        </div>
      </section>

      <div className="report-body-grid">
        <section className="report-section scorecard-section" aria-labelledby="scorecard-heading">
          <div className="section-heading-row">
            <div><p className="eyebrow">Question scores</p><h2 id="scorecard-heading">What stood out</h2></div>
            <span className="section-count">24 responses</span>
          </div>
          <div className="scorecard-list">
            {reportData.questions.map((question, index) => (
              <div className="scorecard-row" key={question.id}>
                <span className="scorecard-index">0{index + 1}</span>
                <div className="scorecard-row-copy">
                  <p>{question.prompt}</p>
                  <div className="scorecard-track" aria-label={`${question.average.toFixed(1)} out of 5 average`}>
                    <span style={{ width: `${question.average * 20}%` }} />
                  </div>
                </div>
                <strong>{question.average.toFixed(1)} <small>/ 5</small></strong>
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
