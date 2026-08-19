export type RatingQuestionId = "usefulness" | "actionability" | "reInvite";

export type SurveyAnswers = {
  usefulness: number | null;
  actionability: number | null;
  reInvite: number | null;
  comment: string;
};

export type MeetingQuestion = {
  id: RatingQuestionId;
  prompt: string;
  helper: string;
};

export type DistributionPoint = {
  rating: number;
  count: number;
  percentage: number;
};

export type ReportQuestion = {
  id: RatingQuestionId;
  prompt: string;
  average: number;
  distribution: DistributionPoint[];
};

export type ReportData = {
  respondents: number;
  invitees: number;
  responseRate: number;
  valueScore: number;
  questions: ReportQuestion[];
  comments: string[];
};

export type MeetingStatus = "open" | "closed";
export type AdminMeeting = {
  id: string;
  title: string;
  chairLabel: string;
  meetingAt: string;
  invitedCount: number;
  status: MeetingStatus;
  hasAccessLinks: boolean;
};
export type MeetingAccess = { surveyAccess: string; reportAccess: string };
export type CreateMeetingInput = Omit<AdminMeeting, "id" | "status" | "hasAccessLinks">;
export type SurveyContext = Pick<AdminMeeting, "id" | "title" | "chairLabel" | "meetingAt" | "status">;
export type CompleteReportView = {
  status: "complete";
  meeting: Pick<AdminMeeting, "title" | "chairLabel" | "meetingAt" | "status">;
  responseCount: number;
  invitedCount: number;
  responseRate: number;
  valueScore: number;
  questions: Array<{
    id: RatingQuestionId;
    prompt: string;
    average: number;
    distribution: Array<{ rating: 1 | 2 | 3 | 4 | 5; count: number }>;
  }>;
  comments: string[];
};
export type ReportView =
  | { status: "threshold_not_met"; minimumResponses: 3 }
  | CompleteReportView;
