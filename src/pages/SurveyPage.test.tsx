import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SurveyPage } from "./SurveyPage";
import { getSurvey, submitSurvey } from "../api";

vi.mock("../api", () => ({
  getSurvey: vi.fn(),
  submitSurvey: vi.fn()
}));

const meeting = {
  id: "meeting-1",
  title: "Investment Committee",
  chairLabel: "Amelia Tan",
  meetingAt: "2026-08-12T09:30:00.000Z",
  invitedCount: 31,
  status: "open" as const
};

describe("SurveyPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the restored survey composition with live meeting context", async () => {
    vi.mocked(getSurvey).mockResolvedValue(meeting);
    render(<SurveyPage access="survey-secret" />);

    expect(await screen.findByRole("heading", { name: "Meeting feedback" })).toBeInTheDocument();
    expect(screen.getByText("Investment Committee")).toBeInTheDocument();
    expect(screen.getByText("Anonymous feedback")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit feedback/i })).toBeInTheDocument();
    expect(getSurvey).toHaveBeenCalledWith("survey-secret");
  });

  it("shows the receipt with the real meeting context after a successful submission", async () => {
    vi.mocked(getSurvey).mockResolvedValue(meeting);
    vi.mocked(submitSurvey).mockResolvedValue({ status: "recorded" });
    render(<SurveyPage access="survey-secret" />);
    await screen.findByRole("heading", { name: "Meeting feedback" });

    for (const prompt of [
      /How useful was this meeting/i,
      /actionable ideas/i,
      /invited to this meeting again/i
    ]) {
      fireEvent.click(screen.getByRole("radio", { name: new RegExp(`${prompt.source}.*5 out of 5`, "i") }));
    }
    fireEvent.click(screen.getByRole("button", { name: /submit feedback/i }));

    expect(await screen.findByRole("heading", { name: "Feedback received" })).toBeInTheDocument();
    expect(screen.getByText("Investment Committee")).toBeInTheDocument();
    expect(submitSurvey).toHaveBeenCalledWith("survey-secret", {
      usefulness: 5,
      actionability: 5,
      reInvite: 5,
      comment: ""
    });
  });

  it("keeps the existing closed-survey state", async () => {
    vi.mocked(getSurvey).mockResolvedValue({ ...meeting, status: "closed" });
    render(<SurveyPage access="survey-secret" />);
    expect(await screen.findByRole("heading", { name: /survey is closed/i })).toBeInTheDocument();
  });
});
