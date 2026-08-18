import type { IncomingMessage, ServerResponse } from "node:http";
import type { FastifyInstance } from "fastify";
import { describe, expect, it, vi } from "vitest";
import { createVercelHandler } from "./vercel-handler.js";

describe("createVercelHandler", () => {
  it("initializes Fastify once and forwards every request to its Node server", async () => {
    const emit = vi.fn();
    const ready = vi.fn().mockResolvedValue(undefined);
    const app = { ready, server: { emit } } as unknown as FastifyInstance;
    const loadApp = vi.fn().mockResolvedValue(app);
    const handler = createVercelHandler(loadApp);
    const firstRequest = {} as IncomingMessage;
    const firstResponse = {} as ServerResponse;
    const secondRequest = {} as IncomingMessage;
    const secondResponse = {} as ServerResponse;

    await handler(firstRequest, firstResponse);
    await handler(secondRequest, secondResponse);

    expect(loadApp).toHaveBeenCalledTimes(1);
    expect(ready).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenNthCalledWith(1, "request", firstRequest, firstResponse);
    expect(emit).toHaveBeenNthCalledWith(2, "request", secondRequest, secondResponse);
  });
});
