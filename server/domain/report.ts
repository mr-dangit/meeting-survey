import type {
  AnonymousResponse,
  CompleteReport,
  Meeting,
  ReportDistributionPoint,
  ReportQuestionId
} from "./types.js";

const questions: Array<{ id: ReportQuestionId; prompt: string }> = [
  { id: "usefulness", prompt: "How useful was this meeting in helping you achieve your goals?" },
  { id: "actionability", prompt: "Did you leave with actionable ideas or clear follow-up tasks?" },
  { id: "reInvite", prompt: "Would you want to be invited to this meeting again?" }
];

const ratings = [1, 2, 3, 4, 5] as const;
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateReport(meeting: Meeting, responses: AnonymousResponse[]): CompleteReport {
  const total = responses.reduce(
    (sum, response) => sum + response.usefulness + response.actionability + response.reInvite,
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
