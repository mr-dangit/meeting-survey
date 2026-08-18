import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { MeetingRepository, ResponseRepository } from "../domain/repositories.js";
import { hashAccessSecret } from "../domain/security.js";
import type { Meeting } from "../domain/types.js";

export const submissionSchema = z
  .object({
    usefulness: z.number().int().min(1).max(5),
    actionability: z.number().int().min(1).max(5),
    reInvite: z.number().int().min(1).max(5),
    comment: z.string().max(1000).default("")
  })
  .strict();

export type SurveySubmission = z.infer<typeof submissionSchema>;

export type PublicSurveyMeeting = Pick<
  Meeting,
  "id" | "title" | "chairLabel" | "meetingAt" | "status"
>;

export class SurveyNotFoundError extends Error {}
export class SurveyClosedError extends Error {}

function toPublicSurveyMeeting(meeting: Meeting): PublicSurveyMeeting {
  return {
    id: meeting.id,
    title: meeting.title,
    chairLabel: meeting.chairLabel,
    meetingAt: meeting.meetingAt,
    status: meeting.status
  };
}

export class SurveyService {
  constructor(
    private readonly meetings: MeetingRepository,
    private readonly responses: ResponseRepository
  ) {}

  async getSurvey(access: string | undefined): Promise<PublicSurveyMeeting> {
    return toPublicSurveyMeeting(await this.findMeeting(access));
  }

  async submit(access: string | undefined, submission: SurveySubmission): Promise<{ status: "recorded" }> {
    const meeting = await this.findMeeting(access);
    if (meeting.status !== "open") throw new SurveyClosedError();

    await this.responses.create({
      id: randomUUID(),
      meetingId: meeting.id,
      usefulness: submission.usefulness,
      actionability: submission.actionability,
      reInvite: submission.reInvite,
      comment: submission.comment.trim(),
      submittedAt: new Date()
    });

    return { status: "recorded" };
  }

  private async findMeeting(access: string | undefined): Promise<Meeting> {
    if (!access) throw new SurveyNotFoundError();
    const meeting = await this.meetings.findBySurveyHash(hashAccessSecret(access));
    if (!meeting) throw new SurveyNotFoundError();
    return meeting;
  }
}
