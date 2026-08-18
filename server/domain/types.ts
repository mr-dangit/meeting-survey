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
