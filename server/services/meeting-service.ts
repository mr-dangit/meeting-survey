import { randomUUID } from "node:crypto";
import { generateAccessSecret, hashAccessSecret } from "../domain/security.js";
import type { MeetingRepository } from "../domain/repositories.js";
import type { Meeting, MeetingStatus } from "../domain/types.js";

export type CreateMeetingInput = {
  title: string;
  chairLabel: string;
  meetingAt: Date;
  invitedCount: number;
};

export type AdminMeeting = Pick<
  Meeting,
  "id" | "title" | "chairLabel" | "meetingAt" | "invitedCount" | "status"
>;

export type CreatedMeeting = {
  meeting: AdminMeeting;
  surveyAccess: string;
  reportAccess: string;
};

function toAdminMeeting(meeting: Meeting): AdminMeeting {
  return {
    id: meeting.id,
    title: meeting.title,
    chairLabel: meeting.chairLabel,
    meetingAt: meeting.meetingAt,
    invitedCount: meeting.invitedCount,
    status: meeting.status
  };
}

export class MeetingService {
  constructor(private readonly meetings: MeetingRepository) {}

  async create(input: CreateMeetingInput): Promise<CreatedMeeting> {
    const surveyAccess = generateAccessSecret();
    const reportAccess = generateAccessSecret();
    const now = new Date();
    const meeting = await this.meetings.create({
      id: randomUUID(),
      title: input.title.trim(),
      chairLabel: input.chairLabel.trim(),
      meetingAt: input.meetingAt,
      invitedCount: input.invitedCount,
      status: "open",
      surveySecretHash: hashAccessSecret(surveyAccess),
      reportSecretHash: hashAccessSecret(reportAccess),
      createdAt: now,
      updatedAt: now
    });

    return { meeting: toAdminMeeting(meeting), surveyAccess, reportAccess };
  }

  async list(): Promise<AdminMeeting[]> {
    return (await this.meetings.list()).map(toAdminMeeting);
  }

  async setStatus(id: string, status: MeetingStatus): Promise<AdminMeeting | null> {
    const meeting = await this.meetings.setStatus(id, status, new Date());
    return meeting ? toAdminMeeting(meeting) : null;
  }
}
