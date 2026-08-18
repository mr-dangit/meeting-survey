import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("meeting feedback prototype", () => {
  it("shows a required error for each unanswered rating", async () => {
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Submit feedback" }));

    expect(screen.getAllByText("Please select a rating.")).toHaveLength(3);
    expect(screen.queryByText("Feedback received")).not.toBeInTheDocument();
  });

  it("shows five outline stars and fills through the selected star", async () => {
    const user = userEvent.setup();

    render(<App />);
    const usefulnessGroup = screen.getByRole("radiogroup", {
      name: "How useful was this meeting in helping you achieve your goals?"
    });

    expect(usefulnessGroup.querySelectorAll(".rating-number")).toHaveLength(0);
    expect(usefulnessGroup.querySelectorAll(".star-symbol.is-outline")).toHaveLength(5);

    await user.click(screen.getByRole("radio", { name: /How useful.*4 out of 5/i }));

    expect(usefulnessGroup.querySelectorAll(".star-symbol.is-filled")).toHaveLength(4);
    expect(usefulnessGroup.querySelectorAll(".star-symbol.is-outline")).toHaveLength(1);
  });

  it("keeps the attendee view as one centered form without a side panel", () => {
    render(<App />);

    expect(screen.queryByRole("complementary", { name: "About this survey" })).not.toBeInTheDocument();
  });

  it("shows a receipt with the respondent's own answers after submission", async () => {
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("radio", { name: /How useful.*4 out of 5/i }));
    await user.click(screen.getByRole("radio", { name: /actionable ideas.*5 out of 5/i }));
    await user.click(screen.getByRole("radio", { name: /invited.*3 out of 5/i }));
    await user.type(
      screen.getByRole("textbox", { name: /one thing that would make this meeting more valuable/i }),
      "A short decision recap would help."
    );
    await user.click(screen.getByRole("button", { name: "Submit feedback" }));

    expect(screen.getByText("Feedback received")).toBeInTheDocument();
    expect(screen.getByText("4 / 5")).toBeInTheDocument();
    expect(screen.getByText("5 / 5")).toBeInTheDocument();
    expect(screen.getByText("3 / 5")).toBeInTheDocument();
    expect(screen.getByText("A short decision recap would help.")).toBeInTheDocument();
  });

  it("keeps the chair report accessible from a demo URL without a header button", () => {
    const originalUrl = window.location.href;
    window.history.pushState({}, "", "/?view=report");

    try {
      render(<App />);
      expect(screen.getByRole("heading", { name: "Chair report" })).toBeInTheDocument();
      expect(screen.getByText("Meeting Value Score")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Chair report" })).not.toBeInTheDocument();
    } finally {
      window.history.replaceState({}, "", originalUrl);
    }
  });

  it("puts the key chair report takeaways into a glanceable scorecard", () => {
    const originalUrl = window.location.href;
    window.history.pushState({}, "", "/?view=report");

    try {
      render(<App />);

      expect(screen.getByText("Question scores")).toBeInTheDocument();
      expect(screen.getByText("Highest score")).toBeInTheDocument();
      expect(screen.getByText("4.3 / 5")).toBeInTheDocument();
      expect(screen.queryByText("Signal")).not.toBeInTheDocument();
      expect(document.querySelectorAll(".scorecard-row")).toHaveLength(3);
    } finally {
      window.history.replaceState({}, "", originalUrl);
    }
  });

  it("shows the historical series dashboard from its demo URL", () => {
    const originalUrl = window.location.href;
    window.history.pushState({}, "", "/?view=series");

    try {
      render(<App />);

      expect(screen.getByRole("heading", { name: "Investment Committee" })).toBeInTheDocument();
      expect(screen.getByText("Six-meeting history")).toBeInTheDocument();
      expect(screen.getByText("Rolling 3-meeting average")).toBeInTheDocument();
      expect(screen.getByText("+0.2 vs previous")).toBeInTheDocument();
      expect(screen.getAllByRole("row")).toHaveLength(7);
    } finally {
      window.history.replaceState({}, "", originalUrl);
    }
  });

  it("compares all three survey questions across the series", () => {
    const originalUrl = window.location.href;
    window.history.pushState({}, "", "/?view=series");

    try {
      render(<App />);

      expect(screen.getByRole("heading", { name: "Question trends" })).toBeInTheDocument();
      expect(document.querySelectorAll(".question-trend-row")).toHaveLength(3);
      expect(screen.getByText("Response count & rate")).toBeInTheDocument();
    } finally {
      window.history.replaceState({}, "", originalUrl);
    }
  });

  it("links a historical occurrence to its detailed chair report", () => {
    const originalUrl = window.location.href;
    window.history.pushState({}, "", "/?view=series");

    try {
      render(<App />);

      const latestReportLink = screen.getByRole("link", { name: "View 12 Aug report" });
      expect(latestReportLink).toHaveAttribute("href", "/?view=report&occurrence=2026-08-12");
    } finally {
      window.history.replaceState({}, "", originalUrl);
    }
  });
});
