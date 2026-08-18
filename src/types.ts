export type RatingQuestionId = "usefulness" | "actionability" | "reInvite";

export type SurveyAnswers = {
  usefulness: number | null;
  actionability: number | null;
  reInvite: number | null;
  comment: string;
};

export type SeriesOccurrence = {
  id: string;
  dateLabel: string;
  shortDate: string;
  chair: string;
  valueScore: number;
  respondents: number;
  invitees: number;
  responseRate: number;
  questions: Record<RatingQuestionId, number>;
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
