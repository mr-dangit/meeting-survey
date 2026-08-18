import type { RatingQuestionId, SurveyAnswers } from "./types";

export type ValidationErrors = Partial<Record<RatingQuestionId, string>>;

export function validateSurvey(answers: SurveyAnswers): ValidationErrors {
  const errors: ValidationErrors = {};

  const requiredQuestions: RatingQuestionId[] = [
    "usefulness",
    "actionability",
    "reInvite"
  ];

  requiredQuestions.forEach((questionId) => {
    if (answers[questionId] === null) {
      errors[questionId] = "Please select a rating.";
    }
  });

  return errors;
}
