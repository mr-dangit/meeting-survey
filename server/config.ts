import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  ADMIN_PASSPHRASE: z.string().min(12),
  SESSION_SECRET: z.string().min(32)
});

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl: string;
  adminPassphrase: string;
  sessionSecret: string;
};

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const value = envSchema.parse(env);
  return {
    nodeEnv: value.NODE_ENV,
    port: value.PORT,
    databaseUrl: value.DATABASE_URL,
    adminPassphrase: value.ADMIN_PASSPHRASE,
    sessionSecret: value.SESSION_SECRET
  };
}
