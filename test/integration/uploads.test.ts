import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import {
  clearChildrenAndGrowth,
  createOtherUsersChild,
} from "../support/helpers.js";

let app: FastifyInstance;

/** 子供を1件作成して、そのレスポンス body を返すヘルパー。 */
async function createChild(payload: {
  name: string;
  birthday: string;
  gender: string;
}) {
  const res = await app.inject({ method: "POST", url: "/children", payload });
  return res.json();
}

/** 署名付きアップロード URL を要求するヘルパー。 */
async function requestUploadUrl(payload: {
  purpose?: string;
  targetId?: string;
  contentType?: string;
}) {
  return app.inject({ method: "POST", url: "/uploads/image-url", payload });
}

beforeAll(async () => {
  app = buildApp({ logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await clearChildrenAndGrowth();
});

describe("POST /uploads/image-url", () => {
  it("本人の子供 + 許可形式 → 200 で署名付き URL とキーを返す", async () => {
    const child = await createChild({
      name: "そうた",
      birthday: "2024-01-01",
      gender: "male",
    });

    const res = await requestUploadUrl({
      purpose: "child",
      targetId: child.id,
      contentType: "image/jpeg",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.uploadUrl).toBeTypeOf("string");
    expect(body.uploadUrl).toContain("X-Amz-Signature");
    // キーは children/<childId>/<uuid>.jpg の形式
    expect(body.key).toMatch(new RegExp(`^children/${child.id}/[\\w-]+\\.jpg$`));
    expect(body.expiresIn).toBeTypeOf("number");
  });

  it("必須項目が欠けると 400", async () => {
    const res = await requestUploadUrl({ purpose: "child" });
    expect(res.statusCode).toBe(400);
  });

  it("未対応の purpose は 400", async () => {
    const res = await requestUploadUrl({
      purpose: "unknown",
      targetId: "x",
      contentType: "image/jpeg",
    });
    expect(res.statusCode).toBe(400);
  });

  it("purpose にプロトタイプのキー（constructor）を渡しても 400", async () => {
    const res = await requestUploadUrl({
      purpose: "constructor",
      targetId: "x",
      contentType: "image/jpeg",
    });
    expect(res.statusCode).toBe(400);
  });

  it("contentType にプロトタイプのキー（constructor）を渡しても 400", async () => {
    const child = await createChild({
      name: "れん",
      birthday: "2024-01-01",
      gender: "male",
    });

    const res = await requestUploadUrl({
      purpose: "child",
      targetId: child.id,
      contentType: "constructor",
    });
    expect(res.statusCode).toBe(400);
  });

  it("対応していない Content-Type は 400", async () => {
    const child = await createChild({
      name: "ゆい",
      birthday: "2024-01-01",
      gender: "female",
    });

    const res = await requestUploadUrl({
      purpose: "child",
      targetId: child.id,
      contentType: "application/pdf",
    });
    expect(res.statusCode).toBe(400);
  });

  it("他人の子供は 404（存在を隠す）", async () => {
    const otherId = await createOtherUsersChild();

    const res = await requestUploadUrl({
      purpose: "child",
      targetId: otherId,
      contentType: "image/png",
    });
    expect(res.statusCode).toBe(404);
  });

  it("存在しない子供は 404", async () => {
    const res = await requestUploadUrl({
      purpose: "child",
      targetId: "999999",
      contentType: "image/png",
    });
    expect(res.statusCode).toBe(404);
  });
});
