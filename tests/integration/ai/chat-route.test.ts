import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// vi.mock is hoisted, so variables referenced inside factories need vi.hoisted().
const { mockStreamJanetTurn, mockStreamSupportTurn, mockToUIMessageStreamResponse } =
  vi.hoisted(() => {
    const mockToUIMessageStreamResponse = vi.fn(
      () => new Response("stream-ok", { status: 200 }),
    );
    const streamResult = { toUIMessageStreamResponse: mockToUIMessageStreamResponse };
    return {
      mockStreamJanetTurn: vi.fn(() => Promise.resolve(streamResult)),
      mockStreamSupportTurn: vi.fn(() => Promise.resolve(streamResult)),
      mockToUIMessageStreamResponse,
    };
  });

vi.mock("@/lib/ai/agents/janet", () => ({
  streamJanetTurn: mockStreamJanetTurn,
}));

vi.mock("@/lib/ai/agents/support", () => ({
  streamSupportTurn: mockStreamSupportTurn,
}));

// ── Auth mock ─────────────────────────────────────────────────────────────────
const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

import { POST as janetPOST } from "@/app/api/chat/route";
import { POST as alexPOST } from "@/app/api/chat/support/route";

function makeRequest(
  body: unknown,
  url = "http://localhost/api/chat",
): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validMessages = [
  { id: "msg-1", role: "user", parts: [{ type: "text", text: "Hello Janet" }] },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-abc" } } });
});
afterEach(() => vi.resetAllMocks());

// ── /api/chat (Janet) ────────────────────────────────────────────────────────
describe("POST /api/chat (Janet)", () => {
  it("returns 401 when the user is not signed in", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await janetPOST(makeRequest({ messages: validMessages }));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Not signed in");
  });

  it("returns 400 when the request body is malformed JSON", async () => {
    const req = new NextRequest("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{{",
    });
    const res = await janetPOST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when messages is missing from the body", async () => {
    const res = await janetPOST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when messages is an empty array", async () => {
    const res = await janetPOST(makeRequest({ messages: [] }));
    expect(res.status).toBe(400);
  });

  it("calls streamJanetTurn with the authenticated user id and messages", async () => {
    await janetPOST(makeRequest({ messages: validMessages }));
    expect(mockStreamJanetTurn).toHaveBeenCalledWith("user-abc", validMessages);
  });

  it("returns the stream response from streamJanetTurn", async () => {
    const res = await janetPOST(makeRequest({ messages: validMessages }));
    expect(mockToUIMessageStreamResponse).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });
});

// ── /api/chat/support (Support) ─────────────────────────────────────────────
describe("POST /api/chat/support (Support)", () => {
  it("returns 401 when the user is not signed in", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await alexPOST(
      makeRequest(
        { messages: validMessages, currentPath: "/dashboard" },
        "http://localhost/api/chat/support",
      ),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Not signed in");
  });

  it("returns 400 when messages is missing", async () => {
    const res = await alexPOST(
      makeRequest(
        { currentPath: "/dashboard" },
        "http://localhost/api/chat/support",
      ),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when messages is an empty array", async () => {
    const res = await alexPOST(
      makeRequest(
        { messages: [], currentPath: "/dashboard" },
        "http://localhost/api/chat/support",
      ),
    );
    expect(res.status).toBe(400);
  });

  it("calls streamSupportTurn with messages and currentPath", async () => {
    await alexPOST(
      makeRequest(
        { messages: validMessages, currentPath: "/report" },
        "http://localhost/api/chat/support",
      ),
    );
    expect(mockStreamSupportTurn).toHaveBeenCalledWith(validMessages, "/report");
  });

  it("defaults currentPath to '/' when not provided", async () => {
    await alexPOST(
      makeRequest({ messages: validMessages }, "http://localhost/api/chat/support"),
    );
    expect(mockStreamSupportTurn).toHaveBeenCalledWith(validMessages, "/");
  });

  it("returns the stream response from streamSupportTurn", async () => {
    const res = await alexPOST(
      makeRequest(
        { messages: validMessages, currentPath: "/dashboard" },
        "http://localhost/api/chat/support",
      ),
    );
    expect(mockToUIMessageStreamResponse).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });
});
