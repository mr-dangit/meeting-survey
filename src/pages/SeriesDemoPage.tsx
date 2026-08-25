import { seriesOccurrences } from "../data";
import type { RatingQuestionId } from "../types";

const ratingQuestionIds: RatingQuestionId[] = ["usefulness", "actionability", "necessity"];

export function SeriesDemoPage() {
  const latest = seriesOccurrences[seriesOccurrences.length - 1];
  const previous = seriesOccurrences[seriesOccurrences.length - 2];
  const recent = seriesOccurrences.slice(-3);
  const rollingAverage = recent.reduce((sum, meeting) => sum + meeting.valueScore, 0) / recent.length;
  const questionLabels: Record<RatingQuestionId, string> = {
    usefulness: "Progress toward goals",
    actionability: "Clarity of next steps",
    necessity: "Meeting was necessary"
  };

  return <main className="content-wrap series-layout" aria-labelledby="series-heading">
    <section className="series-hero">
      <div>
        <p className="eyebrow">Meeting series · <span>Fictional demo data</span></p>
        <h1 id="series-heading">Investment Committee</h1>
        <p className="series-subtitle">Six-meeting history</p>
      </div>
      <div className="series-period"><span>Reporting period</span><strong>Mar — Aug 2026</strong></div>
    </section>

    <section className="series-kpis" aria-label="Latest meeting summary">
      <article className="series-kpi series-kpi-featured"><span>Latest value score</span><strong>{latest.valueScore.toFixed(1)}<small> / 5</small></strong><p className="positive-change">+{(latest.valueScore - previous.valueScore).toFixed(1)} vs previous</p></article>
      <article className="series-kpi"><span>Rolling 3-meeting average</span><strong>{rollingAverage.toFixed(1)}<small> / 5</small></strong><p>Stable upward trajectory</p></article>
      <article className="series-kpi"><span>Latest response rate</span><strong>{latest.responseRate}<small>%</small></strong><p>{latest.respondents} of {latest.invitees} invited attendees</p></article>
    </section>

    <section className="series-panel value-trend-panel" aria-labelledby="value-trend-heading">
      <div className="series-section-heading"><div><p className="eyebrow">Meeting Value Score</p><h2 id="value-trend-heading">Value over time</h2></div><div className="trend-legend"><span /><span>Occurrence score</span><i /><span>3-meeting average</span></div></div>
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
          {ratingQuestionIds.map((questionId) => <div className="question-trend-row" key={questionId}>
            <div><span>{questionLabels[questionId]}</span><strong>{latest.questions[questionId].toFixed(1)}</strong></div>
            <svg viewBox="0 0 360 54" role="img" aria-label={`${questionLabels[questionId]} trend ending at ${latest.questions[questionId].toFixed(1)} out of 5`}>
              <polyline points={seriesOccurrences.map((meeting, index) => `${8 + index * 68},${48 - (meeting.questions[questionId] - 3.4) * 38}`).join(" ")} />
              {seriesOccurrences.map((meeting, index) => <circle key={meeting.id} cx={8 + index * 68} cy={48 - (meeting.questions[questionId] - 3.4) * 38} r="3" />)}
            </svg>
          </div>)}
        </div>
      </section>

      <section className="series-panel" aria-labelledby="response-heading">
        <div className="series-section-heading"><div><p className="eyebrow">Participation</p><h2 id="response-heading">Response count &amp; rate</h2></div></div>
        <div className="response-bars">
          {seriesOccurrences.map((meeting) => <div className="response-bar" key={meeting.id}><div className="response-bar-track"><span style={{ height: `${meeting.responseRate}%` }}><b>{meeting.responseRate}%</b></span></div><strong>{meeting.respondents}</strong><small>{meeting.shortDate}</small></div>)}
        </div>
      </section>
    </div>

    <section className="history-section" aria-labelledby="history-heading">
      <div className="series-section-heading"><div><p className="eyebrow">Occurrence archive</p><h2 id="history-heading">Meeting history</h2></div><span className="section-count">6 occurrences</span></div>
      <div className="history-table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Chair</th><th>Value score</th><th>Responses</th><th>Rate</th><th><span className="sr-only">Detailed report</span></th></tr></thead>
          <tbody>{[...seriesOccurrences].reverse().map((meeting, index) => <tr key={meeting.id}>
            <td><strong>{meeting.dateLabel}</strong>{index === 0 ? <span className="latest-label">Latest</span> : null}</td>
            <td>{meeting.chair}</td><td>{meeting.valueScore.toFixed(1)} / 5</td><td>{meeting.respondents} / {meeting.invitees}</td><td>{meeting.responseRate}%</td>
            <td><span className="demo-report" aria-label={`Demo report for ${meeting.shortDate}`}>Demo report</span></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  </main>;
}
