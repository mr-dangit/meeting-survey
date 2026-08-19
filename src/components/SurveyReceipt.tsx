import type { SurveyAnswers, SurveyContext } from "../types";

type Props = {
  meeting: SurveyContext;
  answers: SurveyAnswers;
  onEdit: () => void;
};

function formatMeetingContext(meeting: SurveyContext) {
  const date = new Date(meeting.meetingAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
  return `${date} · ${meeting.chairLabel}`;
}

const receiptQuestions: Array<{ id: keyof Pick<SurveyAnswers, "usefulness" | "actionability" | "reInvite">; label: string }> = [
  { id: "usefulness", label: "Meeting usefulness" },
  { id: "actionability", label: "Actionable follow-up" },
  { id: "reInvite", label: "Would attend again" }
];

export function SurveyReceipt({ meeting, answers, onEdit }: Props) {
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
          <span>{meeting.title}</span>
          <strong>{formatMeetingContext(meeting)}</strong>
        </section>

        <div className="receipt-answers" aria-label="Your submitted answers">
          {receiptQuestions.map((question) => (
            <div className="receipt-answer" key={question.id}>
              <span>{question.label}</span>
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
