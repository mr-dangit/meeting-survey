import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SurveyPage } from "./SurveyPage";
import { getSurvey, reviseSurvey, submitSurvey } from "../api";

vi.mock("../api", () => ({
  // `ApiError` is part of the module's surface: the page narrows on it in every catch block, so a
  // mock without it throws a reference error instead of exercising the failure path.
  ApiError: class ApiError extends Error {
    constructor(message: string, public readonly status: number) {
      super(message);
    }
  },
  getSurvey: vi.fn(),
  reviseSurvey: vi.fn(),
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

    expect(await screen.findByRole("heading", { name: "Investment Committee" })).toBeInTheDocument();
    expect(screen.getByText("Investment Committee")).toBeInTheDocument();
    expect(screen.getByText("Anonymous meeting feedback")).toBeInTheDocument();
    expect(screen.getByText("0 of 3 answered")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit feedback/i })).toBeInTheDocument();
    expect(getSurvey).toHaveBeenCalledWith("survey-secret");
  });

  it("shows the receipt with the real meeting context after a successful submission", async () => {
    vi.mocked(getSurvey).mockResolvedValue(meeting);
    vi.mocked(submitSurvey).mockResolvedValue({ status: "recorded", responseId: "response-1" });
    render(<SurveyPage access="survey-secret" />);
    await screen.findByRole("heading", { name: "Investment Committee" });

    for (const prompt of [
      /To what extent did this meeting/i,
      /next steps after this meeting/i,
      /How necessary was this meeting/i
    ]) {
      fireEvent.click(screen.getByRole("radio", { name: new RegExp(`${prompt.source}.*5 out of 5`, "i") }));
    }
    fireEvent.click(screen.getByRole("button", { name: /submit feedback/i }));

    expect(await screen.findByRole("heading", { name: "Feedback received" })).toBeInTheDocument();
    expect(screen.getByText("Investment Committee")).toBeInTheDocument();
    expect(submitSurvey).toHaveBeenCalledWith("survey-secret", {
      usefulness: 5,
      actionability: 5,
      necessity: 5,
      comment: ""
    });
  });

  it("revises the response it already filed instead of submitting a second one", async () => {
    vi.mocked(getSurvey).mockResolvedValue(meeting);
    vi.mocked(submitSurvey).mockResolvedValue({ status: "recorded", responseId: "response-1" });
    vi.mocked(reviseSurvey).mockResolvedValue({ status: "recorded", responseId: "response-1" });
    render(<SurveyPage access="survey-secret" />);
    await screen.findByRole("heading", { name: "Investment Committee" });

    for (const prompt of [
      /To what extent did this meeting/i,
      /next steps after this meeting/i,
      /How necessary was this meeting/i
    ]) {
      fireEvent.click(screen.getByRole("radio", { name: new RegExp(`${prompt.source}.*2 out of 5`, "i") }));
    }
    fireEvent.click(screen.getByRole("button", { name: /submit feedback/i }));
    await screen.findByRole("heading", { name: "Feedback received" });

    fireEvent.click(screen.getByRole("button", { name: /edit response/i }));

    // The button now offers an update, which is the visible signal that resubmitting will not add a
    // second response.
    const update = await screen.findByRole("button", { name: /update feedback/i });
    fireEvent.click(screen.getByRole("radio", { name: /To what extent did this meeting.*5 out of 5/i }));
    fireEvent.click(update);

    expect(await screen.findByRole("heading", { name: "Feedback updated" })).toBeInTheDocument();
    expect(reviseSurvey).toHaveBeenCalledWith("survey-secret", "response-1", {
      usefulness: 5,
      actionability: 2,
      necessity: 2,
      comment: ""
    });
    expect(submitSurvey).toHaveBeenCalledTimes(1);
  });

  it("surfaces a failed revision without losing the edited answers", async () => {
    vi.mocked(getSurvey).mockResolvedValue(meeting);
    vi.mocked(submitSurvey).mockResolvedValue({ status: "recorded", responseId: "response-1" });
    vi.mocked(reviseSurvey).mockRejectedValue(new Error("network down"));
    render(<SurveyPage access="survey-secret" />);
    await screen.findByRole("heading", { name: "Investment Committee" });

    for (const prompt of [
      /To what extent did this meeting/i,
      /next steps after this meeting/i,
      /How necessary was this meeting/i
    ]) {
      fireEvent.click(screen.getByRole("radio", { name: new RegExp(`${prompt.source}.*3 out of 5`, "i") }));
    }
    fireEvent.click(screen.getByRole("button", { name: /submit feedback/i }));
    await screen.findByRole("heading", { name: "Feedback received" });
    fireEvent.click(screen.getByRole("button", { name: /edit response/i }));
    fireEvent.click(await screen.findByRole("button", { name: /update feedback/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be saved/i);
    expect(screen.getByRole("button", { name: /update feedback/i })).toBeInTheDocument();
  });

  it("keeps the existing closed-survey state", async () => {
    vi.mocked(getSurvey).mockResolvedValue({ ...meeting, status: "closed" });
    render(<SurveyPage access="survey-secret" />);
    expect(await screen.findByRole("heading", { name: /survey is closed/i })).toBeInTheDocument();
  });
});
