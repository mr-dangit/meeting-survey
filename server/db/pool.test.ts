import { describe, expect, it } from "vitest";
import { createPool } from "./pool.js";

describe("createPool", () => {
  it("limits each serverless instance to one database connection by default", async () => {
    const pool = createPool("postgresql://127.0.0.1:1/postgres") as unknown as {
      options: { max: number };
      end(): Promise<void>;
    };

    expect(pool.options.max).toBe(1);
    await pool.end();
  });
});
