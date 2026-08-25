import { describe, expect, it } from "vitest";
import { validateSurvey } from "./validation";

const emptyAnswers = {
  usefulness: null,
  actionability: null,
  necessity: null,
  comment: ""
};

describe("validateSurvey", () => {
  it("requires all three ratings", () => {
    expect(validateSurvey(emptyAnswers)).toEqual({
      usefulness: "Please select a rating.",
      actionability: "Please select a rating.",
      necessity: "Please select a rating."
    });
  });

  it("only reports the ratings that are still missing", () => {
    expect(
      validateSurvey({
        usefulness: 5,
        actionability: null,
        necessity: 4,
        comment: "A little more time for questions would help."
      })
    ).toEqual({ actionability: "Please select a rating." });
  });

  it("accepts a complete response with an optional comment", () => {
    expect(
      validateSurvey({
        usefulness: 4,
        actionability: 3,
        necessity: 5,
        comment: "Clear discussion and helpful next steps."
      })
    ).toEqual({});
  });
});

it("rejects out-of-range ratings and oversized comments", () => {
  expect(validateSurvey({ usefulness: 0, actionability: 6, necessity: 2.5, comment: "x".repeat(1001) })).toEqual({
    usefulness: "Please select a rating.",
    actionability: "Please select a rating.",
    necessity: "Please select a rating.",
    comment: "Keep the comment to 1,000 characters or fewer."
  });
});
