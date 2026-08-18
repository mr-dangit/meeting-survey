import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const env = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://127.0.0.1:1/meeting_feedback",
  ADMIN_PASSPHRASE: "test-admin-passphrase",
  SESSION_SECRET: "test-session-secret-at-least-32-characters"
};

function runPnpm(args: string[]) {
  const invocation =
    process.platform === "win32"
      ? { executable: process.env.ComSpec ?? "cmd.exe", args: ["/d", "/s", "/c", `${command} ${args.join(" ")}`] }
      : { executable: command, args };

  return spawnSync(invocation.executable, invocation.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env,
    timeout: 30_000
  });
}

describe("migration CLI package script", () => {
  it(
    "runs the emitted migration CLI before attempting its database connection",
    () => {
      const build = runPnpm(["build"]);
      expect(build.status, build.stderr).toBe(0);

      const migrate = runPnpm(["migrate"]);
      const output = `${migrate.stdout}\n${migrate.stderr}`;

      expect(migrate.status).not.toBe(0);
      expect(output).toContain("ECONNREFUSED");
    },
    60_000
  );
});
