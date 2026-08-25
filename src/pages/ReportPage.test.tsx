import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportPage } from "./ReportPage";
import { getReport } from "../api";

vi.mock("../api", () => ({ getReport: vi.fn() }));

describe("ReportPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the awaiting-response state without scores or counts", async () => {
    vi.mocked(getReport).mockResolvedValue({ status: "threshold_not_met", minimumResponses: 1 });
    render(<ReportPage access="report-secret" />);
    expect(await screen.findByRole("heading", { name: "Chair report" })).toBeInTheDocument();
    expect(screen.getByText(/first anonymous response/i)).toBeInTheDocument();
    expect(screen.queryByText(/Meeting Value Score/i)).not.toBeInTheDocument();
  });

  it("renders live aggregate metrics, distributions, and comments", async () => {
    vi.mocked(getReport).mockResolvedValue({
      status: "complete",
      meeting: { title: "Investment Committee", chairLabel: "Amelia Tan", meetingAt: "2026-08-12T09:30:00.000Z", status: "open" },
      responseCount: 3,
      invitedCount: 5,
      responseRate: 60,
      valueScore: 3.78,
      questions: [
        { id: "usefulness", prompt: "How useful was this meeting?", average: 4, distribution: [{ rating: 1, count: 0 }, { rating: 2, count: 0 }, { rating: 3, count: 1 }, { rating: 4, count: 1 }, { rating: 5, count: 1 }] },
        { id: "actionability", prompt: "Did you leave with actionable ideas?", average: 3.33, distribution: [{ rating: 1, count: 0 }, { rating: 2, count: 1 }, { rating: 3, count: 1 }, { rating: 4, count: 0 }, { rating: 5, count: 1 }] },
        { id: "necessity", prompt: "Would you want to be invited again?", average: 4, distribution: [{ rating: 1, count: 0 }, { rating: 2, count: 0 }, { rating: 3, count: 0 }, { rating: 4, count: 3 }, { rating: 5, count: 0 }] }
      ],
      comments: ["Useful discussion."]
    });
    render(<ReportPage access="report-secret" />);
    expect(await screen.findByRole("heading", { name: "Chair report" })).toBeInTheDocument();
    expect(screen.getByText("3.78")).toBeInTheDocument();
    expect(screen.getByText("3 of 5 attendees")).toBeInTheDocument();
    expect(screen.getByText("Useful discussion.")).toBeInTheDocument();
  });
});
