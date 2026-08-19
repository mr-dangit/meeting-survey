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
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
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
      formElement.reset();
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

  const link = (kind: "survey" | "report", access: string) =>
    `${window.location.origin}/#/${kind}/${encodeURIComponent(access)}`;

  if (!authenticated) {
    return <main className="content-wrap admin-layout" aria-labelledby="admin-login-heading">
      <section className="admin-intro">
        <p className="eyebrow">Meeting feedback administration</p>
        <h1 id="admin-login-heading">Meeting feedback administration</h1>
        <p className="intro-copy">Create a private survey link and a chair report for each meeting.</p>
      </section>
      <section className="admin-panel login-panel" aria-label="Administrator login">
        <form className="admin-form" onSubmit={handleLogin}>
          <label htmlFor="passphrase">Administrator passphrase<input id="passphrase" name="passphrase" type="password" required /></label>
          <button className="primary-button" type="submit">Log in <span aria-hidden="true">→</span></button>
          {error ? <p role="alert" className="form-error">{error}</p> : null}
        </form>
      </section>
    </main>;
  }

  return <main className="content-wrap admin-layout" aria-labelledby="admin-heading">
    <section className="admin-intro">
      <p className="eyebrow">Meeting feedback administration</p>
      <h1 id="admin-heading">Set up a meeting</h1>
      <p className="intro-copy">Create a private survey link and a chair report for each meeting.</p>
    </section>
    <section className="admin-panel">
      <form className="admin-form" onSubmit={handleCreate}>
        <label htmlFor="title">Meeting title<input id="title" name="title" required maxLength={200} /></label>
        <label htmlFor="chairLabel">Chair label<input id="chairLabel" name="chairLabel" required maxLength={120} /></label>
        <label htmlFor="meetingAt">Meeting date and time<input id="meetingAt" name="meetingAt" type="datetime-local" required /></label>
        <label htmlFor="invitedCount">Invited attendees<input id="invitedCount" name="invitedCount" type="number" min="1" max="10000" required /></label>
        <button className="primary-button" type="submit">Create meeting <span aria-hidden="true">→</span></button>
      </form>
      {error ? <p role="alert" className="form-error">{error}</p> : null}
    </section>
    {created ? <section className="link-card" aria-labelledby="links-heading">
      <div className="link-card-heading"><div><p className="eyebrow">New meeting</p><h2 id="links-heading">Secret access links</h2></div><button className="text-button" type="button" onClick={() => setCreated(null)}>Dismiss</button></div>
      <p>Save these now. Access values cannot be recovered after leaving this result.</p>
      <div className="link-list">
        <a href={link("survey", created.surveyAccess)}><span>Open attendee survey</span><small>Share with invited attendees →</small></a>
        <a href={link("report", created.reportAccess)}><span>Open chair report</span><small>Keep this link private →</small></a>
      </div>
    </section> : null}
    <section className="admin-meetings" aria-labelledby="meetings-heading">
      <div className="section-heading-row"><div><p className="eyebrow">Saved meetings</p><h2 id="meetings-heading">Meeting list</h2></div><span className="section-count">{meetings.length} meetings</span></div>
      {meetings.length === 0 ? <p className="empty-state">No meetings yet.</p> : meetings.map((meeting) => <article className="meeting-row" key={meeting.id}>
        <div><h3>{meeting.title}</h3><p>{meeting.chairLabel} · {new Date(meeting.meetingAt).toLocaleDateString()}</p></div>
        <span className={`status-pill status-${meeting.status}`}>{meeting.status}</span>
        <button className="secondary-button" type="button" disabled={savingId === meeting.id} onClick={() => void toggle(meeting)}>{meeting.status === "open" ? "Close survey" : "Reopen survey"}</button>
      </article>)}
    </section>
  </main>;
}
