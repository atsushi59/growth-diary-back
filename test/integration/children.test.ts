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

beforeAll(async () => {
  app = buildApp({ logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  // children と growth を全削除して各テストを独立させる。マスタとユーザーは残す。
  await clearChildrenAndGrowth();
});

describe("children CRUD API", () => {
  it("POST /children → 201 で作成される", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/children",
      payload: { name: "そうた", birthday: "2024-01-01", gender: "male" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({ name: "そうた", gender: "male" });
    expect(body.id).toBeTypeOf("string");
  });

  it("GET /children → 本人の子供一覧を返す", async () => {
    await createChild({ name: "A", birthday: "2024-01-01", gender: "female" });

    const res = await app.inject({ method: "GET", url: "/children" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("GET /children/:id → 1件取得、存在しなければ 404", async () => {
    const child = await createChild({
      name: "B",
      birthday: "2024-01-01",
      gender: "male",
    });

    const ok = await app.inject({ method: "GET", url: `/children/${child.id}` });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ id: child.id, name: "B" });

    const notFound = await app.inject({ method: "GET", url: "/children/999999" });
    expect(notFound.statusCode).toBe(404);
  });

  it("PUT /children/:id → 全置換で更新される", async () => {
    const child = await createChild({
      name: "C",
      birthday: "2024-01-01",
      gender: "male",
    });

    const res = await app.inject({
      method: "PUT",
      url: `/children/${child.id}`,
      payload: { name: "C2", birthday: "2024-02-02", gender: "female" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: "C2", gender: "female" });
  });

  it("PATCH /children/:id → 渡したフィールドだけ更新される", async () => {
    const child = await createChild({
      name: "D",
      birthday: "2024-01-01",
      gender: "male",
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/children/${child.id}`,
      payload: { name: "D2" },
    });

    expect(res.statusCode).toBe(200);
    // name は更新、gender は元のまま
    expect(res.json()).toMatchObject({ name: "D2", gender: "male" });
  });

  it("DELETE /children/:id → 削除でき、再削除は 404", async () => {
    const child = await createChild({
      name: "E",
      birthday: "2024-01-01",
      gender: "male",
    });

    const del = await app.inject({
      method: "DELETE",
      url: `/children/${child.id}`,
    });
    expect(del.statusCode).toBe(200);

    const again = await app.inject({
      method: "DELETE",
      url: `/children/${child.id}`,
    });
    expect(again.statusCode).toBe(404);
  });

  describe("所有権（他人の子は触れない）", () => {
    it("一覧に他人の子は含まれない", async () => {
      await createOtherUsersChild();
      await createChild({ name: "自分の子", birthday: "2024-01-01", gender: "male" });

      const res = await app.inject({ method: "GET", url: "/children" });

      expect(res.statusCode).toBe(200);
      const list = res.json();
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe("自分の子");
    });

    it("他人の子は GET / PUT / DELETE すべて 404", async () => {
      const otherId = await createOtherUsersChild();

      const get = await app.inject({ method: "GET", url: `/children/${otherId}` });
      expect(get.statusCode).toBe(404);

      const put = await app.inject({
        method: "PUT",
        url: `/children/${otherId}`,
        payload: { name: "乗っ取り", birthday: "2024-01-01", gender: "male" },
      });
      expect(put.statusCode).toBe(404);

      const del = await app.inject({
        method: "DELETE",
        url: `/children/${otherId}`,
      });
      expect(del.statusCode).toBe(404);
    });
  });
});
