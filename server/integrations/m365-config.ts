import { z } from "zod";
import type { MeetingSelectionRules } from "../domain/calendar.js";

/**
 * Microsoft 365 configuration is deliberately kept out of `AppConfig`.
 *
 * The existing app must keep booting with exactly the five environment variables it has today, so
 * this loader is separate, every key is optional, and the feature is off unless `M365_ENABLED` is
 * explicitly `true`. When it is off, no other key is read or validated.
 */

const booleanFlag = z
  .union([z.boolean(), z.string()])
  .transform((value) => (typeof value === "boolean" ? value : value.trim().toLowerCase()))
  .transform((value) => value === true || value === "true" || value === "1" || value === "yes");

const commaList = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  );

const enabledSchema = z.object({
  M365_ENABLED: booleanFlag.optional().default(false)
});

const detailSchema = z.object({
  GRAPH_TENANT_ID: z.string().min(1),
  GRAPH_CLIENT_ID: z.string().min(1),
  GRAPH_CLIENT_SECRET: z.string().min(1),
  GRAPH_CALENDAR_USER_IDS: commaList.pipe(z.array(z.string().min(3)).min(1)),
  GRAPH_SENDER_USER_ID: z.string().min(3).optional(),
  M365_SEND_INVITES: booleanFlag.optional().default(false),
  M365_LOOKBACK_MINUTES: z.coerce.number().int().min(5).max(1440).optional().default(180),
  M365_SETTLE_MINUTES: z.coerce.number().int().min(0).max(240).optional().default(10),
  M365_MAX_AGE_HOURS: z.coerce.number().int().min(1).max(168).optional().default(24),
  M365_MIN_DURATION_MINUTES: z.coerce.number().int().min(0).max(600).optional().default(20),
  M365_MIN_ATTENDEES: z.coerce.number().int().min(1).max(500).optional().default(3),
  M365_REQUIRED_CATEGORY: z.string().min(1).optional(),
  M365_INTERNAL_DOMAINS: commaList.optional().default([]),
  M365_INCLUDE_EXTERNAL_ATTENDEES: booleanFlag.optional().default(false),
  M365_SCHEDULER_MAILBOXES: commaList.optional().default([]),
  M365_SURVEY_BASE_URL: z.string().url().optional(),
  M365_MAX_EVENTS_PER_MAILBOX: z.coerce.number().int().min(1).max(500).optional().default(100)
});

export type M365Config =
  | { enabled: false }
  | {
      enabled: true;
      tenantId: string;
      clientId: string;
      clientSecret: string;
      /** Mailboxes whose calendars are polled. UPNs or object ids. */
      calendarUserIds: string[];
      /** Service mailbox the survey invitation is sent from. */
      senderUserId: string | null;
      /** Second, independent switch: polling can run without any mail being sent. */
      sendInvites: boolean;
      lookbackMinutes: number;
      maxEventsPerMailbox: number;
      surveyBaseUrl: string | null;
      rules: MeetingSelectionRules;
    };

export class M365ConfigError extends Error {}

const lower = (values: string[]) => values.map((value) => value.toLowerCase());

/**
 * Returns `{ enabled: false }` unless `M365_ENABLED` is set to a truthy string. Throws
 * `M365ConfigError` when the flag is on but the supporting configuration is incomplete, so a
 * half-configured deployment fails loudly at start-up rather than silently doing nothing.
 */
export function loadM365Config(env: NodeJS.ProcessEnv): M365Config {
  const flag = enabledSchema.safeParse(env);
  if (!flag.success || !flag.data.M365_ENABLED) return { enabled: false };

  const parsed = detailSchema.safeParse(env);
  if (!parsed.success) {
    const keys = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))].sort();
    throw new M365ConfigError(
      `M365_ENABLED is true but the Microsoft 365 configuration is incomplete: ${keys.join(", ")}.`
    );
  }

  const value = parsed.data;
  if (value.M365_SEND_INVITES && !value.GRAPH_SENDER_USER_ID) {
    throw new M365ConfigError("M365_SEND_INVITES requires GRAPH_SENDER_USER_ID.");
  }

  // `isInternal` treats an empty domain list as "everyone is internal", so excluding external
  // attendees is silently inert unless the internal domains are actually named. Refuse the
  // combination rather than surveying (and possibly emailing) LPs and brokers by default.
  if (!value.M365_INCLUDE_EXTERNAL_ATTENDEES && value.M365_INTERNAL_DOMAINS.length === 0) {
    throw new M365ConfigError(
      "M365_INTERNAL_DOMAINS must list at least one domain unless " +
        "M365_INCLUDE_EXTERNAL_ATTENDEES is true; otherwise every external attendee counts as internal."
    );
  }

  return {
    enabled: true,
    tenantId: value.GRAPH_TENANT_ID,
    clientId: value.GRAPH_CLIENT_ID,
    clientSecret: value.GRAPH_CLIENT_SECRET,
    calendarUserIds: value.GRAPH_CALENDAR_USER_IDS,
    senderUserId: value.GRAPH_SENDER_USER_ID ?? null,
    sendInvites: value.M365_SEND_INVITES,
    lookbackMinutes: value.M365_LOOKBACK_MINUTES,
    maxEventsPerMailbox: value.M365_MAX_EVENTS_PER_MAILBOX,
    surveyBaseUrl: value.M365_SURVEY_BASE_URL ?? null,
    rules: {
      settleMinutes: value.M365_SETTLE_MINUTES,
      maximumAgeHours: value.M365_MAX_AGE_HOURS,
      minimumDurationMinutes: value.M365_MIN_DURATION_MINUTES,
      minimumAttendees: value.M365_MIN_ATTENDEES,
      requiredCategory: value.M365_REQUIRED_CATEGORY ?? null,
      internalDomains: lower(value.M365_INTERNAL_DOMAINS),
      includeExternalAttendees: value.M365_INCLUDE_EXTERNAL_ATTENDEES,
      schedulerMailboxes: lower(value.M365_SCHEDULER_MAILBOXES),
      chairOverrides: {}
    }
  };
}
