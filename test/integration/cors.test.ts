import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = buildApp({ logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("CORS プリフライト", () => {
  it("更新系メソッド（PUT/PATCH/DELETE）が許可されている", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/children/x",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "PATCH",
      },
    });

    const allowMethods = res.headers["access-control-allow-methods"] as string;
    expect(allowMethods).toContain("PATCH");
    expect(allowMethods).toContain("PUT");
    expect(allowMethods).toContain("DELETE");
  });

  it("FRONTEND_ORIGINS で指定した追加オリジンを許可する", async () => {
    process.env.FRONTEND_ORIGINS =
      "http://localhost:5173,https://example.amplifyapp.com";
    const configured = buildApp({ logger: false });
    await configured.ready();

    const res = await configured.inject({
      method: "OPTIONS",
      url: "/children/x",
      headers: {
        origin: "https://example.amplifyapp.com",
        "access-control-request-method": "GET",
      },
    });

    expect(res.headers["access-control-allow-origin"]).toBe(
      "https://example.amplifyapp.com"
    );

    await configured.close();
    delete process.env.FRONTEND_ORIGINS;
  });
});
