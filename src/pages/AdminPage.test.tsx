import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPage } from "./AdminPage";
import { createMeeting, deleteMeeting, getMeetingAccess, listMeetings, setMeetingStatus } from "../api";

vi.mock("../api", () => ({
  ApiError: class ApiError extends Error {},
  createMeeting: vi.fn(),
  deleteMeeting: vi.fn(),
  getMeetingAccess: vi.fn(),
  listMeetings: vi.fn(),
  setMeetingStatus: vi.fn()
}));

const meeting = {
  id: "m1",
  title: "Investment Committee",
  chairLabel: "Amelia Tan",
  meetingAt: "2026-08-12T09:30:00.000Z",
  invitedCount: 5,
  status: "open" as const,
  hasAccessLinks: true
};

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the meeting list without a login step and creates meeting links", async () => {
    vi.mocked(listMeetings).mockResolvedValue([]);
    vi.mocked(createMeeting).mockResolvedValue({
      meeting,
      surveyAccess: "survey-secret",
      reportAccess: "report-secret"
    });
    render(<AdminPage />);

    expect(screen.getByRole("heading", { name: /set up a meeting/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/passphrase/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /log in/i })).not.toBeInTheDocument();
    await waitFor(() => expect(listMeetings).toHaveBeenCalled());
    expect(await screen.findByText(/no meetings yet/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/meeting title/i), { target: { value: meeting.title } });
    fireEvent.change(screen.getByLabelText(/chair label/i), { target: { value: meeting.chairLabel } });
    fireEvent.change(screen.getByLabelText(/meeting date and time/i), { target: { value: "2026-08-12T09:30" } });
    fireEvent.change(screen.getByLabelText(/invited attendees/i), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /create meeting/i }));

    expect(await screen.findByRole("heading", { name: /secret access links/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open attendee survey/i })).toHaveAttribute("href", expect.stringContaining("#/survey/survey-secret"));
    expect(screen.getByRole("link", { name: /open chair report/i })).toHaveAttribute("href", expect.stringContaining("#/report/report-secret"));
  });

  it("closes an open meeting from the meeting list", async () => {
    vi.mocked(listMeetings).mockResolvedValue([meeting]);
    vi.mocked(setMeetingStatus).mockResolvedValue({ ...meeting, status: "closed" });
    render(<AdminPage />);

    expect(await screen.findByRole("button", { name: /close survey/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /close survey/i }));

    await waitFor(() => expect(setMeetingStatus).toHaveBeenCalledWith("m1", "closed"));
    expect(await screen.findByRole("button", { name: /reopen survey/i })).toBeInTheDocument();
  });

  it("reveals the stored access links for a saved meeting on click", async () => {
    vi.mocked(listMeetings).mockResolvedValue([meeting]);
    vi.mocked(getMeetingAccess).mockResolvedValue({
      surveyAccess: "saved-survey-secret",
      reportAccess: "saved-report-secret"
    });
    render(<AdminPage />);

    const show = await screen.findByRole("button", { name: "Show links" });
    expect(screen.queryByRole("link", { name: /open attendee survey/i })).not.toBeInTheDocument();
    fireEvent.click(show);

    await waitFor(() => expect(getMeetingAccess).toHaveBeenCalledWith("m1"));
    expect(await screen.findByRole("link", { name: /open attendee survey/i }))
      .toHaveAttribute("href", expect.stringContaining("#/survey/saved-survey-secret"));
    expect(screen.getByRole("link", { name: /open chair report/i }))
      .toHaveAttribute("href", expect.stringContaining("#/report/saved-report-secret"));

    fireEvent.click(screen.getByRole("button", { name: "Hide links" }));
    expect(screen.queryByRole("link", { name: /open attendee survey/i })).not.toBeInTheDocument();
  });

  it("explains when a meeting predates stored access links", async () => {
    vi.mocked(listMeetings).mockResolvedValue([{ ...meeting, hasAccessLinks: false }]);
    render(<AdminPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Show links" }));

    expect(getMeetingAccess).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot be shown/i);
  });

  it("deletes a meeting only after the inline confirmation is accepted", async () => {
    vi.mocked(listMeetings).mockResolvedValue([meeting]);
    vi.mocked(deleteMeeting).mockResolvedValue(undefined);
    render(<AdminPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    // Arming the confirmation must not delete anything on its own.
    expect(deleteMeeting).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /delete permanently/i }));

    await waitFor(() => expect(deleteMeeting).toHaveBeenCalledWith("m1"));
    expect(await screen.findByText(/no meetings yet/i)).toBeInTheDocument();
  });

  it("keeps the meeting when the confirmation is dismissed", async () => {
    vi.mocked(listMeetings).mockResolvedValue([meeting]);
    render(<AdminPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: /keep meeting/i }));

    expect(deleteMeeting).not.toHaveBeenCalled();
    expect(screen.getByText("Investment Committee")).toBeInTheDocument();
    expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument();
  });

  it("keeps the meeting listed when deleting fails", async () => {
    vi.mocked(listMeetings).mockResolvedValue([meeting]);
    vi.mocked(deleteMeeting).mockRejectedValue(new Error("network down"));
    render(<AdminPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: /delete permanently/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be deleted/i);
    expect(screen.getByText("Investment Committee")).toBeInTheDocument();
  });

  it("surfaces a failure to load the meeting list", async () => {
    vi.mocked(listMeetings).mockRejectedValue(new Error("network down"));
    render(<AdminPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be loaded/i);
  });
});
