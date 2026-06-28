import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// S3 への実通信を避けるため upload.service をモックする（DynamoDB は実 Local を使う）。
vi.mock("../../src/services/upload.service.js", () => ({
  deleteImage: vi.fn().mockResolvedValue(undefined),
  createImageViewUrl: vi.fn().mockResolvedValue("https://example.test/view-url"),
  createImageUploadUrl: vi.fn(),
  isAllowedImageType: vi.fn(),
}));

import { buildApp } from "../../src/app.js";
import * as uploadService from "../../src/services/upload.service.js";
import { clearChildrenAndGrowth } from "../support/helpers.js";

let app: FastifyInstance;

/** 子供を1件作成して、そのレスポンス body を返すヘルパー。 */
async function createChild(payload: {
  name: string;
  birthday: string;
  gender: string;
  image?: string;
}) {
  const res = await app.inject({ method: "POST", url: "/children", payload });
  return res.json();
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
  vi.clearAllMocks();
});

describe("子供の画像 S3 後始末", () => {
  it("image つきの子供を削除すると S3 も削除する", async () => {
    const key = "children/a/photo.jpg";
    const child = await createChild({
      name: "A",
      birthday: "2024-01-01",
      gender: "male",
      image: key,
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/children/${child.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(uploadService.deleteImage).toHaveBeenCalledWith(key);
  });

  it("image 無しの子供削除では S3 削除を呼ばない", async () => {
    const child = await createChild({
      name: "B",
      birthday: "2024-01-01",
      gender: "male",
    });

    await app.inject({ method: "DELETE", url: `/children/${child.id}` });

    expect(uploadService.deleteImage).not.toHaveBeenCalled();
  });

  it("画像差し替え（PATCH）で旧画像を S3 削除する", async () => {
    const oldKey = "children/c/old.jpg";
    const child = await createChild({
      name: "C",
      birthday: "2024-01-01",
      gender: "male",
      image: oldKey,
    });

    const newKey = "children/c/new.jpg";
    await app.inject({
      method: "PATCH",
      url: `/children/${child.id}`,
      payload: { image: newKey },
    });

    expect(uploadService.deleteImage).toHaveBeenCalledWith(oldKey);
    expect(uploadService.deleteImage).not.toHaveBeenCalledWith(newKey);
  });

  it("画像を変えない PATCH では S3 削除を呼ばない", async () => {
    const key = "children/d/keep.jpg";
    const child = await createChild({
      name: "D",
      birthday: "2024-01-01",
      gender: "male",
      image: key,
    });

    await app.inject({
      method: "PATCH",
      url: `/children/${child.id}`,
      payload: { name: "D2" },
    });

    expect(uploadService.deleteImage).not.toHaveBeenCalled();
  });

  it("表示用URLの発行が失敗しても一覧は落とさず imageUrl 無しで返す（best-effort）", async () => {
    const child = await createChild({
      name: "E",
      birthday: "2024-01-01",
      gender: "male",
      image: "children/e/x.jpg",
    });

    // 次の createImageViewUrl 呼び出しだけ失敗させる
    vi.mocked(uploadService.createImageViewUrl).mockRejectedValueOnce(
      new Error("presign failed")
    );

    const res = await app.inject({ method: "GET", url: "/children" });

    expect(res.statusCode).toBe(200);
    const target = res.json().find((c: { id: string }) => c.id === child.id);
    expect(target.image).toBe("children/e/x.jpg");
    expect(target.imageUrl).toBeNull();
  });
});
