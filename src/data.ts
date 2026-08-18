import type { MeetingQuestion, ReportData } from "./types";

export const meetingQuestions: MeetingQuestion[] = [
  {
    id: "usefulness",
    prompt: "How useful was this meeting in helping you achieve your goals?",
    helper: "Think about the clarity, relevance, and value of the discussion."
  },
  {
    id: "actionability",
    prompt: "Did you leave with actionable ideas or clear follow-up tasks?",
    helper: "Consider whether the next steps felt concrete and easy to act on."
  },
  {
    id: "reInvite",
    prompt: "Would you want to be invited to this meeting again?",
    helper: "Your answer helps the chair shape the right attendee list."
  }
];

export const ratingOptions = [1, 2, 3, 4, 5] as const;

export const reportData: ReportData = {
  respondents: 24,
  invitees: 31,
  responseRate: 77,
  valueScore: 4.2,
  questions: [
    {
      id: "usefulness",
      prompt: meetingQuestions[0].prompt,
      average: 4.0,
      distribution: [
        { rating: 1, count: 1, percentage: 4 },
        { rating: 2, count: 1, percentage: 4 },
        { rating: 3, count: 4, percentage: 17 },
        { rating: 4, count: 9, percentage: 38 },
        { rating: 5, count: 9, percentage: 38 }
      ]
    },
    {
      id: "actionability",
      prompt: meetingQuestions[1].prompt,
      average: 3.9,
      distribution: [
        { rating: 1, count: 1, percentage: 4 },
        { rating: 2, count: 2, percentage: 8 },
        { rating: 3, count: 4, percentage: 17 },
        { rating: 4, count: 8, percentage: 33 },
        { rating: 5, count: 9, percentage: 38 }
      ]
    },
    {
      id: "reInvite",
      prompt: meetingQuestions[2].prompt,
      average: 4.3,
      distribution: [
        { rating: 1, count: 0, percentage: 0 },
        { rating: 2, count: 1, percentage: 4 },
        { rating: 3, count: 3, percentage: 13 },
        { rating: 4, count: 7, percentage: 29 },
        { rating: 5, count: 13, percentage: 54 }
      ]
    }
  ],
  comments: [
    "A short recap of decisions at the end would make this easier to carry into the week.",
    "The balance of perspectives was strong. A little more time on the final discussion would help.",
    "Useful context and a focused group — keeping the pre-read concise would make the session even sharper."
  ]
};
