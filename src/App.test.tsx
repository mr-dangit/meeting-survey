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

  it("switches between attendee survey and chair report views", async () => {
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Chair report" }));
    expect(screen.getByRole("heading", { name: "Chair report" })).toBeInTheDocument();
    expect(screen.getByText("Meeting Value Score")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Attendee survey" }));
    expect(screen.getByRole("heading", { name: "Share your perspective" })).toBeInTheDocument();
  });
});
