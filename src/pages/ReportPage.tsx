import { useEffect, useState } from "react";
import { ApiError, getReport } from "../api";
import type { ReportView } from "../types";

export function ReportPage({ access }: { access: string }) {
  const [report, setReport] = useState<ReportView | null>(null);
  const [state, setState] = useState<"loading" | "invalid" | "error" | "ready">("loading");
  const [message, setMessage] = useState("");

  const load = () => {
    setState("loading");
    void getReport(access).then((result) => { setReport(result); setState("ready"); })
      .catch((reason) => {
        setState(reason instanceof ApiError && reason.status === 404 ? "invalid" : "error");
        setMessage(reason.message);
      });
  };
  useEffect(load, [access]);

  if (state === "loading") return <main><p>Loading report…</p></main>;
  if (state === "invalid") return <main><h1>This report link is invalid.</h1></main>;
  if (state === "error") return <main><p role="alert">{message}</p><button onClick={load}>Try again</button></main>;
  if (report?.status === "threshold_not_met") {
    return <main><h1>Chair report</h1><p>Results will appear after at least 3 anonymous responses.</p></main>;
  }
  if (!report) return null;

  return <main className="report-layout"><h1>{report.meeting.title}</h1>
    <section><h2>Responses</h2><p>{report.responseCount} of {report.invitedCount}</p><p>{report.responseRate}%</p></section>
    <section><h2>Meeting Value Score</h2><p>{report.valueScore} / 5</p></section>
    {report.questions.map((question) => <section key={question.id}><h2>{question.prompt}</h2><p>{question.average} / 5</p>
      <ul>{question.distribution.map((point) => <li key={point.rating}>{point.rating}: {point.count}</li>)}</ul></section>)}
    <section><h2>Anonymous comments</h2>{report.comments.length ? report.comments.map((comment, index) => <blockquote key={index}>{comment}</blockquote>) : <p>No comments.</p>}</section>
  </main>;
}
