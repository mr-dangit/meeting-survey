import type { AnonymousResponse, Meeting, MeetingStatus } from "./types.js";

export type DbPool = {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: Row[]; rowCount: number | null }>;
  connect(): Promise<{
    query<Row extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      values?: unknown[]
    ): Promise<{ rows: Row[]; rowCount: number | null }>;
    release(): void;
  }>;
  end(): Promise<void>;
};

export type CreateMeetingRecord = Meeting;

export interface MeetingRepository {
  create(input: CreateMeetingRecord): Promise<Meeting>;
  list(): Promise<Meeting[]>;
  findById(id: string): Promise<Meeting | null>;
  findBySurveyHash(hash: string): Promise<Meeting | null>;
  findByReportHash(hash: string): Promise<Meeting | null>;
  setStatus(id: string, status: MeetingStatus, updatedAt: Date): Promise<Meeting | null>;
  // Returns false when no such meeting existed, so the caller can answer 404 rather than pretending
  // it deleted something. The responses foreign key cascades, so this discards the meeting's
  // feedback with it.
  delete(id: string): Promise<boolean>;
}

// A revision carries only the answers. `submittedAt` stays at the original submission time and the
// row keeps its id, so editing replaces an answer instead of adding a second one to the report.
export type ResponseRevision = Pick<
  AnonymousResponse,
  "usefulness" | "actionability" | "necessity" | "comment"
>;

export interface ResponseRepository {
  create(input: AnonymousResponse): Promise<AnonymousResponse>;
  // Scoped by meetingId as well as id: a response id is only editable through the survey link of
  // the meeting it belongs to, so one meeting's link can never revise another meeting's row.
  update(id: string, meetingId: string, revision: ResponseRevision): Promise<AnonymousResponse | null>;
  listForMeeting(meetingId: string): Promise<AnonymousResponse[]>;
}
