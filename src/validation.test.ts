import { describe, expect, it } from "vitest";
import { validateSurvey } from "./validation";

const emptyAnswers = {
  usefulness: null,
  actionability: null,
  reInvite: null,
  comment: ""
};

describe("validateSurvey", () => {
  it("requires all three ratings", () => {
    expect(validateSurvey(emptyAnswers)).toEqual({
      usefulness: "Please select a rating.",
      actionability: "Please select a rating.",
      reInvite: "Please select a rating."
    });
  });

  it("only reports the ratings that are still missing", () => {
    expect(
      validateSurvey({
        usefulness: 5,
        actionability: null,
        reInvite: 4,
        comment: "A little more time for questions would help."
      })
    ).toEqual({ actionability: "Please select a rating." });
  });

  it("accepts a complete response with an optional comment", () => {
    expect(
      validateSurvey({
        usefulness: 4,
        actionability: 3,
        reInvite: 5,
        comment: "Clear discussion and helpful next steps."
      })
    ).toEqual({});
  });
});
