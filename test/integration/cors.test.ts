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
});
