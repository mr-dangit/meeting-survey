import type { MeetingRepository, ResponseRepository } from "../domain/repositories.js";
import { calculateReport } from "../domain/report.js";
import { hashAccessSecret } from "../domain/security.js";
import type { ReportResult } from "../domain/types.js";

export class ReportNotFoundError extends Error {}

export class ReportService {
  constructor(
    private readonly meetings: MeetingRepository,
    private readonly responses: ResponseRepository
  ) {}

  async getReport(access: string | undefined): Promise<ReportResult> {
    if (!access) throw new ReportNotFoundError();
    const meeting = await this.meetings.findByReportHash(hashAccessSecret(access));
    if (!meeting) throw new ReportNotFoundError();
    const responses = await this.responses.listForMeeting(meeting.id);
    if (responses.length < 1) return { status: "threshold_not_met", minimumResponses: 1 };
    return calculateReport(meeting, responses);
  }
}
