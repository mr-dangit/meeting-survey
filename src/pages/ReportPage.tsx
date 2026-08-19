import { useEffect, useState } from "react";
import { ApiError, getReport } from "../api";
import type { CompleteReportView, ReportView } from "../types";

export function ReportPage({ access }: { access: string }) {
  const [report, setReport] = useState<ReportView | null>(null);
  const [state, setState] = useState<"loading" | "invalid" | "error" | "ready">("loading");
  const [message, setMessage] = useState("");

  const load = () => {
    setState("loading");
    void getReport(access).then((result) => {
      setReport(result);
      setState("ready");
    }).catch((reason) => {
      setState(reason instanceof ApiError && reason.status === 404 ? "invalid" : "error");
      setMessage(reason instanceof Error ? reason.message : "The report could not be loaded. Please try again.");
    });
  };
  useEffect(load, [access]);

  if (state === "loading") return <main><p>Loading report…</p></main>;
  if (state === "invalid") return <main><h1>This report link is invalid.</h1></main>;
  if (state === "error") return <main><p role="alert">{message}</p><button type="button" onClick={load}>Try again</button></main>;
  if (report?.status === "threshold_not_met") {
    return <main className="content-wrap report-layout" aria-labelledby="report-heading">
      <section className="report-intro threshold-state">
        <div><p className="eyebrow">Private meeting report</p><h1 id="report-heading">Chair report</h1><p className="intro-copy">Results will appear as soon as the first anonymous response arrives.</p></div>
        <span className="threshold-badge">Awaiting responses</span>
      </section>
    </main>;
  }
  if (!report) return null;

  return <CompleteReport report={report} />;
}

function CompleteReport({ report }: { report: CompleteReportView }) {
  const highestRatedQuestion = report.questions.reduce((highest, question) => (
    question.average > highest.average ? question : highest
  ), report.questions[0]);

  return <main className="content-wrap report-layout" aria-labelledby="report-heading">
    <section className="report-intro">
      <div><p className="eyebrow">Live meeting report · {report.responseCount} responses</p><h1 id="report-heading">Chair report</h1><p className="intro-copy">A quick read on how the meeting landed, with anonymous comments to guide the next one.</p></div>
      <span className="live-badge">Live report</span>
    </section>
    <section className="report-overview" aria-label="Meeting overview">
      <div className="overview-score">
        <span>Meeting Value Score</span>
        <strong>{report.valueScore.toFixed(2)}<small> / 5</small></strong>
        <div className="overview-track" aria-label={`${report.valueScore.toFixed(2)} out of 5 overall score`}><span style={{ width: `${report.valueScore * 20}%` }} /></div>
        <p>{report.responseCount} of {report.invitedCount} attendees responded.</p>
      </div>
      <div className="overview-facts">
        <div className="overview-fact"><span>Response rate</span><strong>{report.responseRate}%</strong><p>{report.responseCount} of {report.invitedCount} attendees</p></div>
        <div className="overview-fact"><span>Highest score</span><strong>{highestRatedQuestion.average.toFixed(2)} / 5</strong><p>{highestRatedQuestion.prompt}</p></div>
      </div>
    </section>
    <div className="report-body-grid">
      <section className="report-section scorecard-section" aria-labelledby="scorecard-heading">
        <div className="section-heading-row"><div><p className="eyebrow">Question scores</p><h2 id="scorecard-heading">What stood out</h2></div><span className="section-count">{report.responseCount} responses</span></div>
        <div className="scorecard-list">
          {report.questions.map((question, index) => <div className="scorecard-row" key={question.id}>
            <span className="scorecard-index">{String(index + 1).padStart(2, "0")}</span>
            <div className="scorecard-row-copy"><p>{question.prompt}</p><div className="scorecard-track" aria-label={`${question.average.toFixed(2)} out of 5 average`}><span style={{ width: `${question.average * 20}%` }} /></div></div>
            <strong>{question.average.toFixed(2)} <small>/ 5</small></strong>
          </div>)}
        </div>
      </section>
      <section className="report-section comments-section" aria-labelledby="comments-heading">
        <div className="section-heading-row"><div><p className="eyebrow">Anonymous comments</p><h2 id="comments-heading">What people said</h2></div><span className="section-count">{report.comments.length} notes</span></div>
        <div className="comment-list">{report.comments.length ? report.comments.map((comment, index) => <blockquote key={`${comment}-${index}`}>{comment}</blockquote>) : <p>No comments.</p>}</div>
      </section>
    </div>
    <section className="distribution-section report-section" aria-labelledby="distribution-heading">
      <div className="section-heading-row"><div><p className="eyebrow">Response distribution</p><h2 id="distribution-heading">A fuller picture</h2></div><span className="section-count">Scale of 1 to 5</span></div>
      <div className="distribution-grid">
        {report.questions.map((question) => <div className="distribution-card" key={question.id}>
          <p>{question.prompt}</p>
          <div className="distribution-bars">
            {question.distribution.map((point) => {
              const percentage = Math.round((point.count / report.responseCount) * 100);
              return <div className="distribution-bar-wrap" key={point.rating}>
                <span className="distribution-count">{point.count}</span>
                <div className="distribution-bar-track" aria-label={`${percentage}% of responses rated ${point.rating}`}><span style={{ height: `${Math.max(percentage, 4)}%` }} /></div>
                <span className="distribution-label">{point.rating}</span>
              </div>;
            })}
          </div>
        </div>)}
      </div>
    </section>
  </main>;
}
