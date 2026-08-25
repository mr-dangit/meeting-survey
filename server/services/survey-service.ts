import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { MeetingRepository, ResponseRepository } from "../domain/repositories.js";
import { hashAccessSecret } from "../domain/security.js";
import type { Meeting } from "../domain/types.js";

export const submissionSchema = z
  .object({
    usefulness: z.number().int().min(1).max(5),
    actionability: z.number().int().min(1).max(5),
    necessity: z.number().int().min(1).max(5),
    comment: z.string().max(1000).default("")
  })
  .strict();

export type SurveySubmission = z.infer<typeof submissionSchema>;

export type PublicSurveyMeeting = Pick<
  Meeting,
  "id" | "title" | "chairLabel" | "meetingAt" | "status"
>;

// The response id is handed back to the submitter so the receipt's "Edit response" can revise that
// row instead of filing a second one. It is a random uuid tied to no identity, and the client keeps
// it in memory only, so it never becomes a durable link between a person and their answers.
export type RecordedResponse = { status: "recorded"; responseId: string };

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

  async submit(access: string | undefined, submission: SurveySubmission): Promise<RecordedResponse> {
    const meeting = await this.openMeeting(access);

    const created = await this.responses.create({
      id: randomUUID(),
      meetingId: meeting.id,
      usefulness: submission.usefulness,
      actionability: submission.actionability,
      necessity: submission.necessity,
      comment: submission.comment.trim(),
      submittedAt: new Date()
    });

    return { status: "recorded", responseId: created.id };
  }

  async revise(
    access: string | undefined,
    responseId: string,
    submission: SurveySubmission
  ): Promise<RecordedResponse> {
    const meeting = await this.openMeeting(access);

    const updated = await this.responses.update(responseId, meeting.id, {
      usefulness: submission.usefulness,
      actionability: submission.actionability,
      necessity: submission.necessity,
      comment: submission.comment.trim()
    });
    // An id that does not belong to this meeting is reported as not found rather than forbidden, so
    // the error cannot be used to test whether some other meeting holds that response.
    if (!updated) throw new SurveyNotFoundError();

    return { status: "recorded", responseId: updated.id };
  }

  private async openMeeting(access: string | undefined): Promise<Meeting> {
    const meeting = await this.findMeeting(access);
    if (meeting.status !== "open") throw new SurveyClosedError();
    return meeting;
  }

  private async findMeeting(access: string | undefined): Promise<Meeting> {
    if (!access) throw new SurveyNotFoundError();
    const meeting = await this.meetings.findBySurveyHash(hashAccessSecret(access));
    if (!meeting) throw new SurveyNotFoundError();
    return meeting;
  }
}
