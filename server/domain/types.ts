export type MeetingStatus = "open" | "closed";

export type Meeting = {
  id: string;
  title: string;
  chairLabel: string;
  meetingAt: Date;
  invitedCount: number;
  status: MeetingStatus;
  surveySecretHash: string;
  reportSecretHash: string;
  surveySecret: string | null;
  reportSecret: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AnonymousResponse = {
  id: string;
  meetingId: string;
  usefulness: number;
  actionability: number;
  reInvite: number;
  comment: string;
  submittedAt: Date;
};

export type ReportQuestionId = "usefulness" | "actionability" | "reInvite";
export type ReportDistributionPoint = { rating: 1 | 2 | 3 | 4 | 5; count: number };
export type ReportQuestion = {
  id: ReportQuestionId;
  prompt: string;
  average: number;
  distribution: ReportDistributionPoint[];
};
export type CompleteReport = {
  status: "complete";
  meeting: { title: string; chairLabel: string; meetingAt: string; status: MeetingStatus };
  responseCount: number;
  invitedCount: number;
  responseRate: number;
  valueScore: number;
  questions: ReportQuestion[];
  comments: string[];
};
export type ReportResult =
  | { status: "threshold_not_met"; minimumResponses: 3 }
  | CompleteReport;
