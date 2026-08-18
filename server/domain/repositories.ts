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
  findBySurveyHash(hash: string): Promise<Meeting | null>;
  findByReportHash(hash: string): Promise<Meeting | null>;
  setStatus(id: string, status: MeetingStatus, updatedAt: Date): Promise<Meeting | null>;
}

export interface ResponseRepository {
  create(input: AnonymousResponse): Promise<AnonymousResponse>;
  listForMeeting(meetingId: string): Promise<AnonymousResponse[]>;
}
