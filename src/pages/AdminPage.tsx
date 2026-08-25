import { useEffect, useState, type FormEvent } from "react";
import { ApiError, createMeeting, deleteMeeting, getMeetingAccess, listMeetings, setMeetingStatus } from "../api";
import type { AdminMeeting, MeetingAccess } from "../types";

export function AdminPage() {
  const [meetings, setMeetings] = useState<AdminMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [created, setCreated] = useState<{ surveyAccess: string; reportAccess: string } | null>(null);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [openId, setOpenId] = useState("");
  const [access, setAccess] = useState<Record<string, MeetingAccess>>({});
  const [accessError, setAccessError] = useState<Record<string, string>>({});
  const [loadingAccessId, setLoadingAccessId] = useState("");
  // Deleting discards the meeting's responses along with it, so the button arms an inline
  // confirmation on the row instead of acting on the first click.
  const [confirmDeleteId, setConfirmDeleteId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  // Kept per row: the form error at the top of the page is out of sight when the list is
  // scrolled, so a failed delete has to report itself next to the button that was pressed.
  const [deleteError, setDeleteError] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    listMeetings()
      .then((result) => {
        if (active) setMeetings(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof ApiError ? reason.message : "Meetings could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
      setAccess((current) => ({
        ...current,
        [result.meeting.id]: { surveyAccess: result.surveyAccess, reportAccess: result.reportAccess }
      }));
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

  async function remove(meeting: AdminMeeting) {
    setDeletingId(meeting.id);
    setDeleteError((current) => ({ ...current, [meeting.id]: "" }));
    try {
      await deleteMeeting(meeting.id);
      setMeetings((current) => current.filter((item) => item.id !== meeting.id));
      // Drop the row's cached secrets and any expanded panel too, so nothing survives the meeting
      // it belonged to.
      setAccess((current) => {
        const next = { ...current };
        delete next[meeting.id];
        return next;
      });
      setAccessError((current) => {
        const next = { ...current };
        delete next[meeting.id];
        return next;
      });
      setConfirmDeleteId("");
      if (openId === meeting.id) setOpenId("");
      setError("");
      setDeleteError((current) => {
        const next = { ...current };
        delete next[meeting.id];
        return next;
      });
    } catch (reason) {
      setDeleteError((current) => ({
        ...current,
        [meeting.id]: reason instanceof ApiError
          ? `Meeting could not be deleted: ${reason.message}`
          : "Meeting could not be deleted. The server did not answer."
      }));
    } finally {
      setDeletingId("");
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

  const link = (kind: "survey" | "report", access: string) =>
    `${window.location.origin}/#/${kind}/${encodeURIComponent(access)}`;

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
      <p>Share these with care. They stay available under the meeting below.</p>
      <div className="link-list">
        <a href={link("survey", created.surveyAccess)}><span>Open attendee survey</span><small>Share with invited attendees →</small></a>
        <a href={link("report", created.reportAccess)}><span>Open chair report</span><small>Keep this link private →</small></a>
      </div>
    </section> : null}
    <section className="admin-meetings" aria-labelledby="meetings-heading">
      <div className="section-heading-row"><div><p className="eyebrow">Saved meetings</p><h2 id="meetings-heading">Meeting list</h2></div><span className="section-count">{meetings.length} meetings</span></div>
      {loading ? <p className="empty-state">Loading meetings…</p> : null}
      {!loading && meetings.length === 0 ? <p className="empty-state">No meetings yet.</p> : meetings.map((meeting) => {
        const expanded = openId === meeting.id;
        const links = access[meeting.id];
        const failure = accessError[meeting.id];
        return <article className="meeting-row" key={meeting.id}>
          <div><h3>{meeting.title}</h3><p>{meeting.chairLabel} · {new Date(meeting.meetingAt).toLocaleDateString()}</p></div>
          <span className={`status-pill status-${meeting.status}`}>{meeting.status}</span>
          <button className="secondary-button" type="button" disabled={savingId === meeting.id} onClick={() => void toggle(meeting)}>{meeting.status === "open" ? "Close survey" : "Reopen survey"}</button>
          <button className="secondary-button" type="button" aria-expanded={expanded} aria-controls={`access-${meeting.id}`} onClick={() => void revealAccess(meeting)}>{expanded ? "Hide links" : "Show links"}</button>
          {confirmDeleteId === meeting.id
            ? <div className="delete-confirm" role="group" aria-label={`Confirm deleting ${meeting.title}`}>
                <p>Delete this meeting and every response filed against it? Its survey and report links stop working. This cannot be undone.</p>
                <button className="danger-button" type="button" disabled={deletingId === meeting.id} onClick={() => void remove(meeting)}>{deletingId === meeting.id ? "Deleting…" : "Delete permanently"}</button>
                <button className="text-button" type="button" onClick={() => setConfirmDeleteId("")}>Keep meeting</button>
                {deleteError[meeting.id] ? <p role="alert" className="form-error delete-error">{deleteError[meeting.id]}</p> : null}
              </div>
            : <button className="text-button danger-text" type="button" onClick={() => setConfirmDeleteId(meeting.id)}>Delete</button>}
          {expanded ? <div className="meeting-access" id={`access-${meeting.id}`}>
            <p className="eyebrow">Secret access links</p>
            {loadingAccessId === meeting.id ? <p className="empty-state">Loading access links…</p> : null}
            {!meeting.hasAccessLinks ? <p role="alert" className="form-error">This meeting was created before access links were stored, so they cannot be shown.</p> : null}
            {failure ? <p role="alert" className="form-error">{failure}</p> : null}
            {links ? <div className="link-list">
              <a href={link("survey", links.surveyAccess)}><span>Open attendee survey</span><small>Share with invited attendees →</small></a>
              <a href={link("report", links.reportAccess)}><span>Open chair report</span><small>Keep this link private →</small></a>
            </div> : null}
            {links ? <div className="access-values">
              <code>{link("survey", links.surveyAccess)}</code>
              <code>{link("report", links.reportAccess)}</code>
            </div> : null}
          </div> : null}
        </article>;
      })}
    </section>
  </main>;
}
