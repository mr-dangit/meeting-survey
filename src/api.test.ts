import { afterEach, describe, expect, it, vi } from "vitest";
import { createMeeting, deleteMeeting, listMeetings } from "./api";

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const headersOf = (fetchMock: ReturnType<typeof stubFetch>) =>
  new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers as HeadersInit);

describe("api request headers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // A bodyless request labelled as JSON is refused by Fastify with a 400, which is what made the
  // delete button report "Bad Request".
  it("omits the JSON content-type when there is no body", async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));

    await deleteMeeting("10000000-0000-4000-8000-000000000001");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/meetings/10000000-0000-4000-8000-000000000001",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(headersOf(fetchMock).has("content-type")).toBe(false);
  });

  it("omits it on reads too", async () => {
    const fetchMock = stubFetch(new Response("[]", { status: 200 }));

    await listMeetings();

    expect(headersOf(fetchMock).has("content-type")).toBe(false);
  });

  it("sends the JSON content-type with a body", async () => {
    const fetchMock = stubFetch(new Response("{}", { status: 201 }));

    await createMeeting({
      title: "Weekly investment review",
      chairLabel: "Meeting chair",
      meetingAt: "2026-08-18T08:00:00.000Z",
      invitedCount: 5
    });

    expect(headersOf(fetchMock).get("content-type")).toBe("application/json");
  });
});
