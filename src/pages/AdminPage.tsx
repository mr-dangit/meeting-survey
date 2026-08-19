import { useState, type FormEvent } from "react";
import { ApiError, createMeeting, getMeetingAccess, listMeetings, login, setMeetingStatus } from "../api";
import type { AdminMeeting, MeetingAccess } from "../types";

const link = (kind: "survey" | "report", access: string) =>
  `${window.location.origin}/#/${kind}/${encodeURIComponent(access)}`;

export function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [meetings, setMeetings] = useState<AdminMeeting[]>([]);
  const [created, setCreated] = useState<{ surveyAccess: string; reportAccess: string } | null>(null);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [openId, setOpenId] = useState("");
  const [access, setAccess] = useState<Record<string, MeetingAccess>>({});
  const [accessError, setAccessError] = useState<Record<string, string>>({});
  const [loadingAccessId, setLoadingAccessId] = useState("");

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
      setAccess((current) => ({
        ...current,
        [result.meeting.id]: { surveyAccess: result.surveyAccess, reportAccess: result.reportAccess }
      }));
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

  async function revealAccess(meeting: AdminMeeting) {
    if (openId === meeting.id) {
      setOpenId("");
      return;
    }

    setOpenId(meeting.id);
    if (access[meeting.id] || !meeting.hasAccessLinks) return;

    setLoadingAccessId(meeting.id);
    try {
      const result = await getMeetingAccess(meeting.id);
      setAccess((current) => ({ ...current, [meeting.id]: result }));
      setAccessError((current) => ({ ...current, [meeting.id]: "" }));
    } catch (reason) {
      setAccessError((current) => ({
        ...current,
        [meeting.id]: reason instanceof ApiError ? reason.message : "Access links could not be loaded."
      }));
    } finally {
      setLoadingAccessId("");
    }
  }

  if (!authenticated) {
    return <main className="survey-layout"><h1>Meeting feedback administration</h1><form onSubmit={handleLogin}>
      <label>Administrator passphrase<input name="passphrase" type="password" required /></label>
      <button type="submit">Log in</button>{error && <p role="alert">{error}</p>}
    </form></main>;
  }

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
      <p>Share these with care. They stay available under the meeting below.</p>
      <p><a href={link("survey", created.surveyAccess)}>Open attendee survey</a> — shared secret</p>
      <p><a href={link("report", created.reportAccess)}>Open chair report</a> — private secret</p>
    </section>}
    <section><h2>Meetings</h2>{meetings.length === 0 ? <p>No meetings yet.</p> : meetings.map((meeting) => {
      const expanded = openId === meeting.id;
      const links = access[meeting.id];
      const failure = accessError[meeting.id];
      return <article key={meeting.id} className="admin-meeting"><h3>{meeting.title}</h3>
        <p>{meeting.chairLabel} · {meeting.status}</p>
        <button disabled={savingId === meeting.id} onClick={() => void toggle(meeting)}>
          {meeting.status === "open" ? "Close survey" : "Reopen survey"}
        </button>
        <button aria-expanded={expanded} aria-controls={`access-${meeting.id}`} onClick={() => void revealAccess(meeting)}>
          {expanded ? "Hide secret access links" : "Show secret access links"}
        </button>
        {expanded && <div id={`access-${meeting.id}`} className="admin-access">
          <h4>Secret access links</h4>
          {loadingAccessId === meeting.id && <p>Loading access links…</p>}
          {!meeting.hasAccessLinks && <p role="alert">
            This meeting was created before access links were stored, so they cannot be shown.
          </p>}
          {failure && <p role="alert">{failure}</p>}
          {links && <>
            <p><a href={link("survey", links.surveyAccess)}>Open attendee survey</a> — shared secret</p>
            <p><code>{link("survey", links.surveyAccess)}</code></p>
            <p><a href={link("report", links.reportAccess)}>Open chair report</a> — private secret</p>
            <p><code>{link("report", links.reportAccess)}</code></p>
          </>}
        </div>}
      </article>;
    })}</section>
  </main>;
}
