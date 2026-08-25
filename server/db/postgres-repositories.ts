import type {
  DbPool,
  MeetingRepository,
  ResponseRepository,
  ResponseRevision
} from "../domain/repositories.js";
import type { AnonymousResponse, Meeting, MeetingStatus } from "../domain/types.js";

type MeetingRow = {
  id: string;
  title: string;
  chair_label: string;
  meeting_at: Date | string;
  invited_count: number;
  status: MeetingStatus;
  survey_secret_hash: string;
  report_secret_hash: string;
  survey_secret: string | null;
  report_secret: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type ResponseRow = {
  id: string;
  meeting_id: string;
  usefulness: number;
  actionability: number;
  necessity: number;
  comment: string;
  submitted_at: Date | string;
};

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function mapMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    title: row.title,
    chairLabel: row.chair_label,
    meetingAt: asDate(row.meeting_at),
    invitedCount: row.invited_count,
    status: row.status,
    surveySecretHash: row.survey_secret_hash,
    reportSecretHash: row.report_secret_hash,
    surveySecret: row.survey_secret ?? null,
    reportSecret: row.report_secret ?? null,
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at)
  };
}

function mapResponse(row: ResponseRow): AnonymousResponse {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    usefulness: row.usefulness,
    actionability: row.actionability,
    necessity: row.necessity,
    comment: row.comment,
    submittedAt: asDate(row.submitted_at)
  };
}

export class PostgresMeetingRepository implements MeetingRepository {
  constructor(private readonly pool: DbPool) {}

  async create(input: Meeting): Promise<Meeting> {
    const result = await this.pool.query<MeetingRow>(
      `insert into meetings
       (id, title, chair_label, meeting_at, invited_count, status, survey_secret_hash, report_secret_hash, survey_secret, report_secret, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       returning *`,
      [
        input.id,
        input.title,
        input.chairLabel,
        input.meetingAt,
        input.invitedCount,
        input.status,
        input.surveySecretHash,
        input.reportSecretHash,
        input.surveySecret,
        input.reportSecret,
        input.createdAt,
        input.updatedAt
      ]
    );
    return mapMeeting(result.rows[0]);
  }

  async list(): Promise<Meeting[]> {
    const result = await this.pool.query<MeetingRow>("select * from meetings order by created_at asc");
    return result.rows.map(mapMeeting);
  }

  async findById(id: string): Promise<Meeting | null> {
    const result = await this.pool.query<MeetingRow>("select * from meetings where id = $1", [id]);
    return result.rows[0] ? mapMeeting(result.rows[0]) : null;
  }

  async findBySurveyHash(hash: string): Promise<Meeting | null> {
    const result = await this.pool.query<MeetingRow>(
      "select * from meetings where survey_secret_hash = $1",
      [hash]
    );
    return result.rows[0] ? mapMeeting(result.rows[0]) : null;
  }

  async findByReportHash(hash: string): Promise<Meeting | null> {
    const result = await this.pool.query<MeetingRow>(
      "select * from meetings where report_secret_hash = $1",
      [hash]
    );
    return result.rows[0] ? mapMeeting(result.rows[0]) : null;
  }

  async setStatus(id: string, status: MeetingStatus, updatedAt: Date): Promise<Meeting | null> {
    const result = await this.pool.query<MeetingRow>(
      "update meetings set status = $1, updated_at = $2 where id = $3 returning *",
      [status, updatedAt, id]
    );
    return result.rows[0] ? mapMeeting(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    // `returning id` rather than a rowCount check: pg-mem and pg report affected rows differently
    // for deletes, and a returned row is unambiguous in both.
    const result = await this.pool.query<{ id: string }>(
      "delete from meetings where id = $1 returning id",
      [id]
    );
    return result.rows.length > 0;
  }
}

export class PostgresResponseRepository implements ResponseRepository {
  constructor(private readonly pool: DbPool) {}

  async create(input: AnonymousResponse): Promise<AnonymousResponse> {
    const result = await this.pool.query<ResponseRow>(
      `insert into responses
       (id, meeting_id, usefulness, actionability, necessity, comment, submitted_at)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning *`,
      [
        input.id,
        input.meetingId,
        input.usefulness,
        input.actionability,
        input.necessity,
        input.comment,
        input.submittedAt
      ]
    );
    return mapResponse(result.rows[0]);
  }

  async update(
    id: string,
    meetingId: string,
    revision: ResponseRevision
  ): Promise<AnonymousResponse | null> {
    const result = await this.pool.query<ResponseRow>(
      `update responses
       set usefulness = $1, actionability = $2, necessity = $3, comment = $4
       where id = $5 and meeting_id = $6
       returning *`,
      [
        revision.usefulness,
        revision.actionability,
        revision.necessity,
        revision.comment,
        id,
        meetingId
      ]
    );
    return result.rows[0] ? mapResponse(result.rows[0]) : null;
  }

  async listForMeeting(meetingId: string): Promise<AnonymousResponse[]> {
    const result = await this.pool.query<ResponseRow>(
      "select * from responses where meeting_id = $1 order by submitted_at asc",
      [meetingId]
    );
    return result.rows.map(mapResponse);
  }
}
