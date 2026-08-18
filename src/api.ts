import type {
  AdminMeeting,
  CreateMeetingInput,
  ReportView,
  SurveyAnswers,
  SurveyContext
} from "./types";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...init.headers }
  });
  const body = response.status === 204 ? undefined : await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body?.error ?? "Something went wrong. Please try again.", response.status);
  return body as T;
}

export const login = (passphrase: string) => request<void>("/api/admin/session", {
  method: "POST", body: JSON.stringify({ passphrase })
});
export const logout = () => request<void>("/api/admin/session", { method: "DELETE" });
export const listMeetings = () => request<AdminMeeting[]>("/api/admin/meetings");
export const createMeeting = (input: CreateMeetingInput) =>
  request<{ meeting: AdminMeeting; surveyAccess: string; reportAccess: string }>("/api/admin/meetings", {
    method: "POST", body: JSON.stringify(input)
  });
export const setMeetingStatus = (id: string, status: "open" | "closed") =>
  request<AdminMeeting>(`/api/admin/meetings/${encodeURIComponent(id)}/status`, {
    method: "PATCH", body: JSON.stringify({ status })
  });
export const getSurvey = (access: string) => request<SurveyContext>("/api/survey", {
  headers: { "x-survey-access": access }
});
export const submitSurvey = (access: string, answers: SurveyAnswers) =>
  request<{ status: "recorded" }>("/api/survey/responses", {
    method: "POST", headers: { "x-survey-access": access }, body: JSON.stringify(answers)
  });
export const getReport = (access: string) => request<ReportView>("/api/report", {
  headers: { "x-report-access": access }
});
