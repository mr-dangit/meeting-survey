import { describe, expect, it } from "vitest";
import { parseHashRoute } from "./routing";

describe("hash routing", () => {
  it("keeps access values in the fragment", () => {
    expect(parseHashRoute("")).toEqual({ kind: "admin" });
    expect(parseHashRoute("#/admin")).toEqual({ kind: "admin" });
    expect(parseHashRoute("#/survey/a%2Fb")).toEqual({ kind: "survey", access: "a/b" });
    expect(parseHashRoute("#/report/chair-secret")).toEqual({ kind: "report", access: "chair-secret" });
    expect(parseHashRoute("#/unknown")).toEqual({ kind: "not_found" });
  });

  it("recognizes the explicitly labeled series demo route", () => {
    expect(parseHashRoute("#/series-demo")).toEqual({ kind: "series_demo" });
  });
});
