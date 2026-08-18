import { useState, type FormEvent } from "react";
import { ApiError, createMeeting, listMeetings, login, setMeetingStatus } from "../api";
import type { AdminMeeting } from "../types";

export function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [meetings, setMeetings] = useState<AdminMeeting[]>([]);
  const [created, setCreated] = useState<{ surveyAccess: string; reportAccess: string } | null>(null);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await login(String(form.get("passphrase") ?? ""));
      setMeetings(await listMeetings());
      setAuthenticated(true);
      setError("");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Login failed.");
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const meetingAt = new Date(String(form.get("meetingAt"))).toISOString();
      const result = await createMeeting({
        title: String(form.get("title")),
        chairLabel: String(form.get("chairLabel")),
        meetingAt,
        invitedCount: Number(form.get("invitedCount"))
      });
      setMeetings((current) => [result.meeting, ...current]);
      setCreated({ surveyAccess: result.surveyAccess, reportAccess: result.reportAccess });
      setError("");
      event.currentTarget.reset();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Check the meeting details and try again.");
    }
  }

  async function toggle(meeting: AdminMeeting) {
    const nextStatus = meeting.status === "open" ? "closed" : "open";
    setSavingId(meeting.id);
    try {
      const updated = await setMeetingStatus(meeting.id, nextStatus);
      setMeetings((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Status could not be saved.");
    } finally {
      setSavingId("");
    }
  }

  if (!authenticated) {
    return <main className="survey-layout"><h1>Meeting feedback administration</h1><form onSubmit={handleLogin}>
      <label>Administrator passphrase<input name="passphrase" type="password" required /></label>
      <button type="submit">Log in</button>{error && <p role="alert">{error}</p>}
    </form></main>;
  }

  const link = (kind: "survey" | "report", access: string) =>
    `${window.location.origin}/#/${kind}/${encodeURIComponent(access)}`;

  return <main className="survey-layout"><h1>Meeting feedback administration</h1>
    <form onSubmit={handleCreate} className="admin-form">
      <label>Meeting title<input name="title" required maxLength={200} /></label>
      <label>Chair label<input name="chairLabel" required maxLength={120} /></label>
      <label>Meeting date and time<input name="meetingAt" type="datetime-local" required /></label>
      <label>Invited attendees<input name="invitedCount" type="number" min="1" max="10000" required /></label>
      <button type="submit">Create meeting</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {created && <section aria-label="New meeting links"><h2>Secret access links</h2>
      <p>Save these now. Access values cannot be recovered after leaving this result.</p>
      <p><a href={link("survey", created.surveyAccess)}>Open attendee survey</a> — shared secret</p>
      <p><a href={link("report", created.reportAccess)}>Open chair report</a> — private secret</p>
    </section>}
    <section><h2>Meetings</h2>{meetings.length === 0 ? <p>No meetings yet.</p> : meetings.map((meeting) =>
      <article key={meeting.id}><h3>{meeting.title}</h3><p>{meeting.chairLabel} · {meeting.status}</p>
        <button disabled={savingId === meeting.id} onClick={() => void toggle(meeting)}>
          {meeting.status === "open" ? "Close survey" : "Reopen survey"}
        </button>
      </article>)}</section>
  </main>;
}
