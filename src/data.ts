import type { MeetingQuestion, ReportData, SeriesOccurrence } from "./types";

export const meetingQuestions: MeetingQuestion[] = [
  {
    id: "usefulness",
    prompt: "To what extent did this meeting help you make progress toward your goals?",
    helper: "Think about the progress the discussion actually moved forward."
  },
  {
    id: "actionability",
    prompt: "How clear are your next steps after this meeting?",
    helper: "Consider whether you know what to do next, and by when."
  },
  {
    id: "necessity",
    prompt: "How necessary was this meeting for you?",
    helper: "Could this have been an update instead of a meeting?"
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
      id: "necessity",
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

export const seriesOccurrences: SeriesOccurrence[] = [
  { id: "2026-03-11", dateLabel: "11 March 2026", shortDate: "11 Mar", chair: "Amelia Tan", valueScore: 3.7, respondents: 18, invitees: 30, responseRate: 60, questions: { usefulness: 3.8, actionability: 3.5, necessity: 3.9 } },
  { id: "2026-04-08", dateLabel: "8 April 2026", shortDate: "8 Apr", chair: "Amelia Tan", valueScore: 3.9, respondents: 21, invitees: 30, responseRate: 70, questions: { usefulness: 3.9, actionability: 3.7, necessity: 4.1 } },
  { id: "2026-05-13", dateLabel: "13 May 2026", shortDate: "13 May", chair: "Amelia Tan", valueScore: 4.0, respondents: 22, invitees: 31, responseRate: 71, questions: { usefulness: 4.0, actionability: 3.8, necessity: 4.2 } },
  { id: "2026-06-10", dateLabel: "10 June 2026", shortDate: "10 Jun", chair: "Amelia Tan", valueScore: 4.1, respondents: 23, invitees: 31, responseRate: 74, questions: { usefulness: 4.1, actionability: 3.9, necessity: 4.3 } },
  { id: "2026-07-08", dateLabel: "8 July 2026", shortDate: "8 Jul", chair: "Amelia Tan", valueScore: 4.0, respondents: 22, invitees: 30, responseRate: 73, questions: { usefulness: 3.9, actionability: 3.9, necessity: 4.2 } },
  { id: "2026-08-12", dateLabel: "12 August 2026", shortDate: "12 Aug", chair: "Amelia Tan", valueScore: 4.2, respondents: 24, invitees: 31, responseRate: 77, questions: { usefulness: 4.0, actionability: 4.1, necessity: 4.5 } }
];
