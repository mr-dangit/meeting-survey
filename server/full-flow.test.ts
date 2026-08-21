import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { createTestDatabase } from "./testing/database.js";

const config = {
  nodeEnv: "test" as const,
  port: 3001,
  databaseUrl: "postgresql://unused"
};

describe("complete meeting feedback flow", () => {
  const cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => Promise.all(cleanups.splice(0).map((cleanup) => cleanup())));

  it("keeps responses anonymous and reports from the first submission", async () => {
    const database = await createTestDatabase();
    const staticRoot = await mkdtemp(path.join(tmpdir(), "meeting-feedback-"));
    await writeFile(path.join(staticRoot, "index.html"), "<main>meeting feedback</main>");
    const app = await buildApp({ ...database, config, staticRoot });
    cleanups.push(async () => {
      await app.close();
      await database.pool.end();
      await rm(staticRoot, { recursive: true, force: true });
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/admin/meetings",
      payload: {
        title: "Weekly investment review",
        chairLabel: "Meeting chair",
        meetingAt: "2026-08-18T08:00:00.000Z",
        invitedCount: 5
      }
    });
    const { meeting, surveyAccess, reportAccess } = created.json();

    const threshold = await app.inject({
      method: "GET",
      url: "/api/report",
      headers: { "x-report-access": reportAccess }
    });
    expect(threshold.json()).toEqual({ status: "threshold_not_met", minimumResponses: 1 });

    const answers = [
      { usefulness: 5, actionability: 4, reInvite: 3, comment: "Shorter pre-read." },
      { usefulness: 4, actionability: 4, reInvite: 5, comment: "" },
      { usefulness: 3, actionability: 2, reInvite: 4, comment: "More decision time." }
    ];
    for (const payload of answers) {
      const response = await app.inject({
        method: "POST",
        url: "/api/survey/responses",
        headers: { "x-survey-access": surveyAccess },
        payload
      });
      expect(response.statusCode).toBe(201);

      if (payload === answers[0]) {
        const afterFirst = await app.inject({
          method: "GET",
          url: "/api/report",
          headers: { "x-report-access": reportAccess }
        });
        expect(afterFirst.json()).toMatchObject({ status: "complete", responseCount: 1 });
      }
    }

    const report = await app.inject({
      method: "GET",
      url: "/api/report",
      headers: { "x-report-access": reportAccess }
    });
    expect(report.json()).toMatchObject({
      status: "complete",
      responseCount: 3,
      invitedCount: 5,
      responseRate: 60,
      valueScore: 3.78,
      comments: ["Shorter pre-read.", "More decision time."],
      questions: [
        {
          id: "usefulness",
          average: 4,
          distribution: [
            { rating: 1, count: 0 }, { rating: 2, count: 0 }, { rating: 3, count: 1 },
            { rating: 4, count: 1 }, { rating: 5, count: 1 }
          ]
        },
        { id: "actionability", average: 3.33 },
        { id: "reInvite", average: 4 }
      ]
    });
    expect(report.body).not.toMatch(/meetingId|submittedAt|surveySecretHash|reportSecretHash/);

    await app.inject({
      method: "PATCH",
      url: `/api/admin/meetings/${meeting.id}/status`,
      payload: { status: "closed" }
    });
    const rejected = await app.inject({
      method: "POST",
      url: "/api/survey/responses",
      headers: { "x-survey-access": surveyAccess },
      payload: answers[0]
    });
    expect(rejected.statusCode).toBe(409);

    const columns = await database.pool.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_name = 'responses' order by column_name"
    );
    expect(columns.rows.map((row) => row.column_name)).toEqual([
      "actionability", "comment", "id", "meeting_id", "re_invite", "submitted_at", "usefulness"
    ]);
    expect((await database.pool.query("select id from responses")).rowCount).toBe(3);
    expect((await app.inject({ method: "GET", url: "/" })).body).toContain("meeting feedback");
  });
});
