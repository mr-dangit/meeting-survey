/**
 * Pure calendar domain logic: which finished meetings deserve a survey, who receives it, and who
 * chairs it. No Microsoft Graph types leak in here — `CalendarEvent` is our own shape, to be mapped
 * from Graph by the integration layer (not written yet). Everything in this file is deterministic
 * and unit-testable without a tenant.
 */

export type AttendeeKind = "required" | "optional" | "resource";

export type AttendeeResponse =
  | "none"
  | "organizer"
  | "tentativelyAccepted"
  | "accepted"
  | "declined"
  | "notResponded";

export type CalendarParticipant = {
  email: string;
  name: string;
};

export type CalendarAttendee = CalendarParticipant & {
  kind: AttendeeKind;
  response: AttendeeResponse;
};

export type CalendarEventType = "singleInstance" | "occurrence" | "exception" | "seriesMaster";

export type CalendarSensitivity = "normal" | "personal" | "private" | "confidential";

export type CalendarEvent = {
  /** Per-mailbox identifier. Not stable across mailboxes — never use it as a dedup key. */
  id: string;
  /** Stable across every attendee's copy of the same meeting. The dedup key, with `start`. */
  iCalUId: string;
  seriesMasterId: string | null;
  subject: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  isCancelled: boolean;
  type: CalendarEventType;
  sensitivity: CalendarSensitivity;
  organizer: CalendarParticipant | null;
  attendees: CalendarAttendee[];
  categories: string[];
};

export type MeetingSelectionRules = {
  /** Grace period after the end time before a meeting is considered surveyable. */
  settleMinutes: number;
  /** Meetings that ended longer ago than this are ignored, so a first run cannot backfill. */
  maximumAgeHours: number;
  minimumDurationMinutes: number;
  minimumAttendees: number;
  /** When set, only events carrying this Outlook category are surveyed (case-insensitive). */
  requiredCategory: string | null;
  /** Domains treated as internal, lowercase, without the `@`. */
  internalDomains: string[];
  includeExternalAttendees: boolean;
  /** Mailboxes that book on someone else's behalf; chair falls through to a required attendee. */
  schedulerMailboxes: string[];
  /** Nominated chair per series or event, keyed by `iCalUId`, lowercase email. */
  chairOverrides: Record<string, string>;
};

export const defaultSelectionRules: MeetingSelectionRules = {
  settleMinutes: 10,
  maximumAgeHours: 24,
  minimumDurationMinutes: 20,
  minimumAttendees: 3,
  requiredCategory: null,
  internalDomains: [],
  includeExternalAttendees: false,
  schedulerMailboxes: [],
  chairOverrides: {}
};

export type SkipReason =
  | "cancelled"
  | "series_master"
  | "all_day"
  | "not_ended"
  | "settling"
  | "too_old"
  | "too_short"
  | "too_few_attendees"
  | "no_organizer"
  | "no_chair"
  | "private"
  | "category_missing"
  | "no_recipients";

export type PlannedSurvey = {
  /** Graph event id, kept for traceability back to the source mailbox. */
  eventId: string;
  iCalUId: string;
  seriesMasterId: string | null;
  isRecurring: boolean;
  subject: string;
  occurrenceStart: Date;
  occurrenceEnd: Date;
  durationMinutes: number;
  chair: CalendarParticipant;
  recipients: CalendarParticipant[];
  invitedCount: number;
};

export type EvaluationResult =
  | { eligible: true; survey: PlannedSurvey }
  | { eligible: false; reason: SkipReason };

const MINUTE_MS = 60_000;

const normaliseEmail = (email: string) => email.trim().toLowerCase();

export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).trim().toLowerCase();
}

/**
 * An empty `internalDomains` list means "cannot classify", and everyone is treated as internal.
 * Callers that exclude external attendees must therefore ensure the list is populated —
 * `loadM365Config` rejects that combination at start-up.
 */
export function isInternal(email: string, internalDomains: string[]): boolean {
  if (internalDomains.length === 0) return true;
  return internalDomains.includes(emailDomain(email));
}

export function durationMinutes(event: Pick<CalendarEvent, "start" | "end">): number {
  return Math.round((event.end.getTime() - event.start.getTime()) / MINUTE_MS);
}

/**
 * Everyone who should be asked to rate the meeting: real people who did not decline, deduplicated
 * by address, with the organizer folded in (they attended too, and the report's response rate has
 * to agree with the invited count).
 */
export function selectRecipients(
  event: CalendarEvent,
  rules: MeetingSelectionRules
): CalendarParticipant[] {
  const seen = new Map<string, CalendarParticipant>();

  const consider = (participant: CalendarParticipant) => {
    const email = normaliseEmail(participant.email);
    if (!email.includes("@")) return;
    if (!rules.includeExternalAttendees && !isInternal(email, rules.internalDomains)) return;
    if (seen.has(email)) return;
    seen.set(email, { email, name: participant.name.trim() || email });
  };

  for (const attendee of event.attendees) {
    if (attendee.kind === "resource") continue;
    if (attendee.response === "declined") continue;
    consider(attendee);
  }
  if (event.organizer) consider(event.organizer);

  return [...seen.values()];
}

/**
 * The organizer chairs the meeting, unless they are a known scheduler mailbox (an EA booking for
 * someone else) or a nominated chair has been recorded for the series.
 */
export function resolveChair(
  event: CalendarEvent,
  rules: MeetingSelectionRules
): CalendarParticipant | null {
  // `hasOwn` guard: an iCalUId such as "constructor" would otherwise resolve to an inherited
  // `Object.prototype` member and be treated as a nominated chair (then crash on `.trim()`).
  const override = Object.hasOwn(rules.chairOverrides, event.iCalUId)
    ? rules.chairOverrides[event.iCalUId]
    : undefined;
  if (override) {
    const email = normaliseEmail(override);
    // The nominated chair may be the organizer rather than an attendee; check both so the
    // display name survives instead of degrading to the raw address.
    const known = [...event.attendees, ...(event.organizer ? [event.organizer] : [])].find(
      (participant) => normaliseEmail(participant.email) === email
    );
    return { email, name: known?.name.trim() || email };
  }

  if (event.organizer) {
    const email = normaliseEmail(event.organizer.email);
    if (!rules.schedulerMailboxes.includes(email)) {
      return { email, name: event.organizer.name.trim() || email };
    }
  }

  const fallback = event.attendees.find(
    (attendee) =>
      attendee.kind === "required" &&
      attendee.response !== "declined" &&
      normaliseEmail(attendee.email) !== normaliseEmail(event.organizer?.email ?? "")
  );
  if (!fallback) return null;
  const email = normaliseEmail(fallback.email);
  return { email, name: fallback.name.trim() || email };
}

/** Decides whether one calendar occurrence should produce a survey, and records why not. */
export function evaluateEvent(
  event: CalendarEvent,
  rules: MeetingSelectionRules,
  now: Date
): EvaluationResult {
  if (event.isCancelled) return { eligible: false, reason: "cancelled" };
  if (event.type === "seriesMaster") return { eligible: false, reason: "series_master" };
  if (event.isAllDay) return { eligible: false, reason: "all_day" };
  if (event.sensitivity === "private" || event.sensitivity === "confidential") {
    return { eligible: false, reason: "private" };
  }

  const endedMsAgo = now.getTime() - event.end.getTime();
  if (endedMsAgo < 0) return { eligible: false, reason: "not_ended" };
  if (endedMsAgo < rules.settleMinutes * MINUTE_MS) return { eligible: false, reason: "settling" };
  if (endedMsAgo > rules.maximumAgeHours * 60 * MINUTE_MS) {
    return { eligible: false, reason: "too_old" };
  }

  if (durationMinutes(event) < rules.minimumDurationMinutes) {
    return { eligible: false, reason: "too_short" };
  }

  if (rules.requiredCategory) {
    const wanted = rules.requiredCategory.trim().toLowerCase();
    const present = event.categories.some((category) => category.trim().toLowerCase() === wanted);
    if (!present) return { eligible: false, reason: "category_missing" };
  }

  if (!event.organizer) return { eligible: false, reason: "no_organizer" };

  const recipients = selectRecipients(event, rules);
  // Most specific reason first: `minimumAttendees` is always >= 1, so a `too_few_attendees` test
  // placed ahead of this one would swallow the empty case entirely.
  if (recipients.length === 0) return { eligible: false, reason: "no_recipients" };
  if (recipients.length < rules.minimumAttendees) {
    return { eligible: false, reason: "too_few_attendees" };
  }

  const chair = resolveChair(event, rules);
  if (!chair) return { eligible: false, reason: "no_chair" };

  return {
    eligible: true,
    survey: {
      eventId: event.id,
      iCalUId: event.iCalUId,
      seriesMasterId: event.seriesMasterId,
      isRecurring: event.type === "occurrence" || event.type === "exception",
      subject: event.subject.trim(),
      occurrenceStart: event.start,
      occurrenceEnd: event.end,
      durationMinutes: durationMinutes(event),
      chair,
      recipients,
      invitedCount: recipients.length
    }
  };
}

/** Stable idempotency key for one occurrence, matching `calendar_events` unique index. */
export function occurrenceKey(iCalUId: string, occurrenceStart: Date): string {
  return `${iCalUId}|${occurrenceStart.toISOString()}`;
}
