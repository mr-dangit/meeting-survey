import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getReport, getSurvey } from "../api";
import { SeriesDemoPage } from "./SeriesDemoPage";

vi.mock("../api", () => ({
  getReport: vi.fn(),
  getSurvey: vi.fn()
}));

describe("SeriesDemoPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders an explicitly labeled fictional historical dashboard without API calls", () => {
    render(<SeriesDemoPage />);

    expect(screen.getByRole("heading", { name: "Investment Committee" })).toBeInTheDocument();
    expect(screen.getByText("Six-meeting history")).toBeInTheDocument();
    expect(screen.getByText("Fictional demo data")).toBeInTheDocument();
    expect(screen.getAllByText("Demo report")).toHaveLength(6);
    expect(getReport).not.toHaveBeenCalled();
    expect(getSurvey).not.toHaveBeenCalled();
  });
});
