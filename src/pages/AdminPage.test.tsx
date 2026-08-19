import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPage } from "./AdminPage";
import { getMeetingAccess, listMeetings, login } from "../api";

vi.mock("../api", () => ({
  ApiError: class ApiError extends Error {},
  createMeeting: vi.fn(),
  getMeetingAccess: vi.fn(),
  listMeetings: vi.fn(),
  login: vi.fn(),
  setMeetingStatus: vi.fn()
}));

const meeting = {
  id: "10000000-0000-4000-8000-000000000001",
  title: "Investment Committee",
  chairLabel: "Amelia Tan",
  meetingAt: "2026-08-12T09:30:00.000Z",
  invitedCount: 5,
  status: "open" as const,
  hasAccessLinks: true
};

async function signIn() {
  const user = userEvent.setup();
  render(<AdminPage />);
  await user.type(screen.getByLabelText(/administrator passphrase/i), "secret");
  await user.click(screen.getByRole("button", { name: "Log in" }));
  return user;
}

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(login).mockResolvedValue(undefined);
    vi.mocked(listMeetings).mockResolvedValue([meeting]);
  });

  it("reveals the stored access links for a saved meeting on click", async () => {
    vi.mocked(getMeetingAccess).mockResolvedValue({
      surveyAccess: "survey-secret",
      reportAccess: "report-secret"
    });
    const user = await signIn();

    expect(await screen.findByRole("heading", { name: "Investment Committee" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /attendee survey/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show secret access links" }));

    expect(getMeetingAccess).toHaveBeenCalledWith(meeting.id);
    expect(await screen.findByRole("link", { name: /attendee survey/i }))
      .toHaveAttribute("href", `${window.location.origin}/#/survey/survey-secret`);
    expect(screen.getByRole("link", { name: /chair report/i }))
      .toHaveAttribute("href", `${window.location.origin}/#/report/report-secret`);

    await user.click(screen.getByRole("button", { name: "Hide secret access links" }));
    expect(screen.queryByRole("link", { name: /attendee survey/i })).not.toBeInTheDocument();
  });

  it("explains when a meeting predates stored access links", async () => {
    vi.mocked(listMeetings).mockResolvedValue([{ ...meeting, hasAccessLinks: false }]);
    const user = await signIn();

    await user.click(await screen.findByRole("button", { name: "Show secret access links" }));

    expect(getMeetingAccess).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/cannot be shown/i);
  });
});
