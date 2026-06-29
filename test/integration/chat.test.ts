import type { FastifyInstance } from "fastify";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { buildApp } from "../../src/app.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = buildApp({ logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

afterEach(() => {
  // 各テストで差し替えた global fetch を元に戻す
  vi.unstubAllGlobals();
});

describe("POST /chat", () => {
  it("AIサービスの応答を中継して返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ reply: "こんにちは" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
      )
    );

    const res = await app.inject({
      method: "POST",
      url: "/chat",
      payload: { message: "やあ" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().reply).toBe("こんにちは");
  });

  it("message が空（空白のみ含む）なら 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/chat",
      payload: { message: "   " },
    });

    expect(res.statusCode).toBe(400);
  });

  it("message が文字列でない（数値）なら 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/chat",
      payload: { message: 123 },
    });

    expect(res.statusCode).toBe(400);
  });

  it("AIサービスへの接続が失敗（タイムアウト等）したら 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout");
      })
    );

    const res = await app.inject({
      method: "POST",
      url: "/chat",
      payload: { message: "やあ" },
    });

    expect(res.statusCode).toBe(502);
  });

  it("AIサービスが失敗したら 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("error", { status: 500 }))
    );

    const res = await app.inject({
      method: "POST",
      url: "/chat",
      payload: { message: "やあ" },
    });

    expect(res.statusCode).toBe(502);
  });
});
