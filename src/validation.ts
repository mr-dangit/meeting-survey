import type { RatingQuestionId, SurveyAnswers } from "./types";

export type ValidationErrors = Partial<Record<RatingQuestionId | "comment", string>>;

export function validateSurvey(answers: SurveyAnswers): ValidationErrors {
  const errors: ValidationErrors = {};

  const requiredQuestions: RatingQuestionId[] = [
    "usefulness",
    "actionability",
    "necessity"
  ];

  requiredQuestions.forEach((questionId) => {
    const value = answers[questionId];
    if (value === null || !Number.isInteger(value) || value < 1 || value > 5) {
      errors[questionId] = "Please select a rating.";
    }
  });

  if (answers.comment.length > 1000) {
    errors.comment = "Keep the comment to 1,000 characters or fewer.";
  }

  return errors;
}
