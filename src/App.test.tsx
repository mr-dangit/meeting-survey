import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";

describe("application routing", () => {
  afterEach(() => { window.location.hash = ""; });

  it("renders administration from the hash route", () => {
    window.location.hash = "#/admin";
    render(<App />);
    expect(screen.getByRole("heading", { name: "Meeting feedback administration" })).toBeInTheDocument();
  });

  it("renders a safe not-found page for unknown routes", () => {
    window.location.hash = "#/unknown";
    render(<App />);
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });
});
