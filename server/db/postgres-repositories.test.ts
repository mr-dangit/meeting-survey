import { afterEach, describe, expect, it } from "vitest";
import type { AnonymousResponse, Meeting } from "../domain/types.js";
import { runMigrations } from "./migrations.js";
import { createTestDatabase } from "../testing/database.js";

const surveyHash = "a".repeat(64);
const reportHash = "b".repeat(64);

function meetingFixture(): Meeting {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    title: "Investment Committee",
    chairLabel: "Chair",
    meetingAt: new Date("2026-08-18T08:00:00.000Z"),
    invitedCount: 12,
    status: "open",
    surveySecretHash: surveyHash,
    reportSecretHash: reportHash,
    surveySecret: "survey-secret-value",
    reportSecret: "report-secret-value",
    createdAt: new Date("2026-08-01T08:00:00.000Z"),
    updatedAt: new Date("2026-08-01T08:00:00.000Z")
  };
}

function responseFixture(meetingId: string): AnonymousResponse {
  return {
    id: "20000000-0000-4000-8000-000000000001",
    meetingId,
    usefulness: 4,
    actionability: 5,
    necessity: 3,
    comment: "End with a decision recap.",
    submittedAt: new Date("2026-08-18T08:30:00.000Z")
  };
}

describe("PostgreSQL repositories", () => {
  const pools: Array<{ end(): Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(pools.splice(0).map((pool) => pool.end()));
  });

  it("round-trips meetings through every meeting repository lookup", async () => {
    const { pool, meetings } = await createTestDatabase();
    pools.push(pool);
    const input = meetingFixture();

    expect(await meetings.create(input)).toEqual(input);
    expect(await meetings.list()).toEqual([input]);
    expect(await meetings.findBySurveyHash(surveyHash)).toEqual(input);
    expect(await meetings.findByReportHash(reportHash)).toEqual(input);

    const updatedAt = new Date("2026-08-18T09:00:00.000Z");
    expect(await meetings.setStatus(input.id, "closed", updatedAt)).toEqual({
      ...input,
      status: "closed",
      updatedAt
    });
    expect(await meetings.findBySurveyHash("c".repeat(64))).toBeNull();
  });

  it("persists an anonymous response without identity columns", async () => {
    const { pool, meetings, responses } = await createTestDatabase();
    pools.push(pool);
    const meeting = await meetings.create(meetingFixture());
    const input = responseFixture(meeting.id);

    expect(await responses.create(input)).toEqual(input);
    expect(await responses.listForMeeting(meeting.id)).toEqual([input]);
    const columns = await pool.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_name = 'responses' order by column_name"
    );
    expect(columns.rows.map((row) => row.column_name)).toEqual([
      "actionability",
      "comment",
      "id",
      "meeting_id",
      "necessity",
      "submitted_at",
      "usefulness"
    ]);
  });

  it("enforces the rating range in the database", async () => {
    const { pool, meetings, responses } = await createTestDatabase();
    pools.push(pool);
    const meeting = await meetings.create(meetingFixture());

    await expect(responses.create({ ...responseFixture(meeting.id), usefulness: 6 })).rejects.toThrow();
    expect(await responses.listForMeeting(meeting.id)).toEqual([]);
  });

  it("cascades anonymous responses when their meeting is deleted", async () => {
    const { pool, meetings, responses } = await createTestDatabase();
    pools.push(pool);
    const meeting = await meetings.create(meetingFixture());
    await responses.create(responseFixture(meeting.id));

    await pool.query("delete from meetings where id = $1", [meeting.id]);

    expect(await responses.listForMeeting(meeting.id)).toEqual([]);
  });

  it("records the versioned migrations exactly once", async () => {
    const { pool } = await createTestDatabase();
    pools.push(pool);

    await runMigrations(pool);

    const result = await pool.query<{ version: number }>("select version from schema_migrations order by version");
    expect(result.rows).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }]);
  });
});
