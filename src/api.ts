import type {
  AdminMeeting,
  CreateMeetingInput,
  MeetingAccess,
  RecordedResponse,
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
  // Only announce a JSON body when there is one. Fastify rejects a request that carries
  // `content-type: application/json` with an empty body (FST_ERR_CTP_EMPTY_JSON_BODY, 400),
  // which is every bodyless DELETE this client sends.
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      ...init.headers
    }
  });
  const body = response.status === 204 ? undefined : await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body?.error ?? "Something went wrong. Please try again.", response.status);
  return body as T;
}

export const listMeetings = () => request<AdminMeeting[]>("/api/admin/meetings");
export const createMeeting = (input: CreateMeetingInput) =>
  request<{ meeting: AdminMeeting; surveyAccess: string; reportAccess: string }>("/api/admin/meetings", {
    method: "POST", body: JSON.stringify(input)
  });
export const getMeetingAccess = (id: string) =>
  request<MeetingAccess>(`/api/admin/meetings/${encodeURIComponent(id)}/access`);
export const setMeetingStatus = (id: string, status: "open" | "closed") =>
  request<AdminMeeting>(`/api/admin/meetings/${encodeURIComponent(id)}/status`, {
    method: "PATCH", body: JSON.stringify({ status })
  });
export const deleteMeeting = (id: string) =>
  request<void>(`/api/admin/meetings/${encodeURIComponent(id)}`, { method: "DELETE" });
export const getSurvey = (access: string) => request<SurveyContext>("/api/survey", {
  headers: { "x-survey-access": access }
});
export const submitSurvey = (access: string, answers: SurveyAnswers) =>
  request<RecordedResponse>("/api/survey/responses", {
    method: "POST", headers: { "x-survey-access": access }, body: JSON.stringify(answers)
  });
export const reviseSurvey = (access: string, responseId: string, answers: SurveyAnswers) =>
  request<RecordedResponse>(`/api/survey/responses/${encodeURIComponent(responseId)}`, {
    method: "PUT", headers: { "x-survey-access": access }, body: JSON.stringify(answers)
  });
export const getReport = (access: string) => request<ReportView>("/api/report", {
  headers: { "x-report-access": access }
});
