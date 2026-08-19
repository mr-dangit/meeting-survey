import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./api", () => ({
  getSurvey: vi.fn(() => new Promise(() => {})),
  getReport: vi.fn(() => new Promise(() => {}))
}));

describe("application routing", () => {
  afterEach(() => { window.location.hash = ""; });

  it("renders administration from the hash route", () => {
    window.location.hash = "#/admin";
    const { container } = render(<App />);
    expect(screen.getByRole("heading", { name: "Meeting feedback administration" })).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByAltText("Dymon Asia Capital")).toBeInTheDocument();
    expect(container.querySelector(".page-rule")).toBeInTheDocument();
  });

  it.each(["#/survey/encoded-access-value", "#/report/encoded-access-value"])("renders the shared shell for %s", (hash) => {
    window.location.hash = hash;
    const { container } = render(<App />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByAltText("Dymon Asia Capital")).toBeInTheDocument();
    expect(container.querySelector(".page-rule")).toBeInTheDocument();
  });

  it("renders the fictional series demo only on its explicit route", () => {
    window.location.hash = "#/series-demo";
    render(<App />);
    expect(screen.getByRole("heading", { name: "Investment Committee" })).toBeInTheDocument();
    expect(screen.getByText("Fictional demo data")).toBeInTheDocument();
  });

  it("renders a safe not-found page for unknown routes", () => {
    window.location.hash = "#/unknown";
    render(<App />);
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });
});
