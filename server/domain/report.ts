import type {
  AnonymousResponse,
  CompleteReport,
  Meeting,
  ReportDistributionPoint,
  ReportQuestionId
} from "./types.js";

const questions: Array<{ id: ReportQuestionId; prompt: string }> = [
  { id: "usefulness", prompt: "To what extent did this meeting help you make progress toward your goals?" },
  { id: "actionability", prompt: "How clear are your next steps after this meeting?" },
  { id: "necessity", prompt: "How necessary was this meeting for you?" }
];

const ratings = [1, 2, 3, 4, 5] as const;
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateReport(meeting: Meeting, responses: AnonymousResponse[]): CompleteReport {
  const total = responses.reduce(
    (sum, response) => sum + response.usefulness + response.actionability + response.necessity,
    0
  );

  return {
    status: "complete",
    meeting: {
      title: meeting.title,
      chairLabel: meeting.chairLabel,
      meetingAt: meeting.meetingAt.toISOString(),
      status: meeting.status
    },
    responseCount: responses.length,
    invitedCount: meeting.invitedCount,
    responseRate: Math.min(100, round2((responses.length / meeting.invitedCount) * 100)),
    valueScore: round2(total / (responses.length * 3)),
    questions: questions.map(({ id, prompt }) => ({
      id,
      prompt,
      average: round2(responses.reduce((sum, response) => sum + response[id], 0) / responses.length),
      distribution: ratings.map((rating): ReportDistributionPoint => ({
        rating,
        count: responses.filter((response) => response[id] === rating).length
      }))
    })),
    comments: responses.map((response) => response.comment.trim()).filter(Boolean)
  };
}
