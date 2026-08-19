import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPage } from "./AdminPage";
import { createMeeting, listMeetings, login, setMeetingStatus } from "../api";

vi.mock("../api", () => ({
  createMeeting: vi.fn(),
  listMeetings: vi.fn(),
  login: vi.fn(),
  setMeetingStatus: vi.fn()
}));

const meeting = {
  id: "m1",
  title: "Investment Committee",
  chairLabel: "Amelia Tan",
  meetingAt: "2026-08-12T09:30:00.000Z",
  invitedCount: 5,
  status: "open" as const
};

describe("AdminPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the restored administrator shell and creates meeting links", async () => {
    vi.mocked(login).mockResolvedValue(undefined);
    vi.mocked(listMeetings).mockResolvedValue([]);
    vi.mocked(createMeeting).mockResolvedValue({
      meeting,
      surveyAccess: "survey-secret",
      reportAccess: "report-secret"
    });
    render(<AdminPage />);

    expect(screen.getByRole("heading", { name: /meeting feedback administration/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/administrator passphrase/i), { target: { value: "correct-passphrase" } });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByRole("heading", { name: /set up a meeting/i })).toBeInTheDocument();
    expect(screen.getByText(/no meetings yet/i)).toBeInTheDocument();

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
    vi.mocked(login).mockResolvedValue(undefined);
    vi.mocked(listMeetings).mockResolvedValue([meeting]);
    vi.mocked(setMeetingStatus).mockResolvedValue({ ...meeting, status: "closed" });
    render(<AdminPage />);

    fireEvent.change(screen.getByLabelText(/administrator passphrase/i), { target: { value: "correct-passphrase" } });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));
    expect(await screen.findByRole("button", { name: /close survey/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /close survey/i }));

    await waitFor(() => expect(setMeetingStatus).toHaveBeenCalledWith("m1", "closed"));
    expect(await screen.findByRole("button", { name: /reopen survey/i })).toBeInTheDocument();
  });
});
