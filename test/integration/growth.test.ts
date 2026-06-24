import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import {
  clearChildrenAndGrowth,
  createOtherUsersChild,
} from "../support/helpers.js";

let app: FastifyInstance;
let childId: string;

/** テスト対象の成長記録を1件作成して body を返すヘルパー。 */
async function createGrowth(payload: Record<string, unknown>) {
  const res = await app.inject({
    method: "POST",
    url: `/children/${childId}/growth`,
    payload,
  });
  return res;
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
  // 各テストで使う子供を1件用意する
  const child = await app.inject({
    method: "POST",
    url: "/children",
    payload: { name: "テスト児", birthday: "2024-01-01", gender: "male" },
  });
  childId = child.json().id;
});

describe("growth CRUD API", () => {
  it("POST /children/:childId/growth → 身長体重ありで 201", async () => {
    const res = await createGrowth({
      height: 75.2,
      weight: 9.1,
      recordedAt: "2025-01-01",
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ childId, height: 75.2, weight: 9.1 });
  });

  it("POST → 体重だけでも 201（身長は null）", async () => {
    const res = await createGrowth({ weight: 9.5, recordedAt: "2025-02-01" });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ height: null, weight: 9.5 });
  });

  it("GET /children/:childId/growth → recordedAt 昇順で返す", async () => {
    await createGrowth({ weight: 9, recordedAt: "2025-03-01" });
    await createGrowth({ weight: 8, recordedAt: "2025-01-01" });

    const res = await app.inject({
      method: "GET",
      url: `/children/${childId}/growth`,
    });

    expect(res.statusCode).toBe(200);
    const list = res.json();
    expect(list).toHaveLength(2);
    expect(list[0].recordedAt < list[1].recordedAt).toBe(true);
  });

  it("PUT /children/:childId/growth/:id → 全置換で更新", async () => {
    const created = (await createGrowth({
      height: 75,
      weight: 9,
      recordedAt: "2025-01-01",
    })).json();

    const res = await app.inject({
      method: "PUT",
      url: `/children/${childId}/growth/${created.id}`,
      payload: { height: 76, weight: 9.3, recordedAt: "2025-01-01" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ height: 76, weight: 9.3 });
  });

  it("PATCH /children/:childId/growth/:id → 渡したフィールドだけ更新", async () => {
    const created = (await createGrowth({
      height: 75,
      weight: 9,
      recordedAt: "2025-01-01",
    })).json();

    const res = await app.inject({
      method: "PATCH",
      url: `/children/${childId}/growth/${created.id}`,
      payload: { weight: 9.8 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ height: 75, weight: 9.8 });
  });

  it("DELETE /children/:childId/growth/:id → 削除でき、再削除は 404", async () => {
    const created = (await createGrowth({
      weight: 9,
      recordedAt: "2025-01-01",
    })).json();

    const del = await app.inject({
      method: "DELETE",
      url: `/children/${childId}/growth/${created.id}`,
    });
    expect(del.statusCode).toBe(200);

    const again = await app.inject({
      method: "DELETE",
      url: `/children/${childId}/growth/${created.id}`,
    });
    expect(again.statusCode).toBe(404);
  });

  describe("バリデーション・認可", () => {
    it("身長も体重も無いと 400", async () => {
      const res = await createGrowth({ recordedAt: "2025-01-01" });
      expect(res.statusCode).toBe(400);
    });

    it("負の値は 400", async () => {
      const res = await createGrowth({ weight: -3, recordedAt: "2025-01-01" });
      expect(res.statusCode).toBe(400);
    });

    it("不正な日付は 400", async () => {
      const res = await createGrowth({ weight: 9, recordedAt: "not-a-date" });
      expect(res.statusCode).toBe(400);
    });

    it("存在しない childId は 404", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/children/999999/growth",
      });
      expect(res.statusCode).toBe(404);
    });

    it("存在しない growth id の更新は 404", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `/children/${childId}/growth/999999`,
        payload: { weight: 9, recordedAt: "2025-01-01" },
      });
      expect(res.statusCode).toBe(404);
    });

    it("他人の子の成長記録は 404（読み書き不可）", async () => {
      const otherId = await createOtherUsersChild();

      const list = await app.inject({
        method: "GET",
        url: `/children/${otherId}/growth`,
      });
      expect(list.statusCode).toBe(404);

      const post = await app.inject({
        method: "POST",
        url: `/children/${otherId}/growth`,
        payload: { weight: 9, recordedAt: "2025-01-01" },
      });
      expect(post.statusCode).toBe(404);
    });

    it("別の子の id 経由では更新・削除できない（404）", async () => {
      // childId（beforeEach の子）に成長記録を作る
      const created = (await createGrowth({
        weight: 9,
        recordedAt: "2025-01-01",
      })).json();

      // 同じ自分の子だが別の子 other を用意
      const other = await app.inject({
        method: "POST",
        url: "/children",
        payload: { name: "別の自分の子", birthday: "2024-05-05", gender: "female" },
      });
      const otherChildId = other.json().id;

      // other の URL から childId の成長記録を更新 → その子の記録ではないので 404
      const put = await app.inject({
        method: "PUT",
        url: `/children/${otherChildId}/growth/${created.id}`,
        payload: { weight: 10, recordedAt: "2025-01-01" },
      });
      expect(put.statusCode).toBe(404);

      const del = await app.inject({
        method: "DELETE",
        url: `/children/${otherChildId}/growth/${created.id}`,
      });
      expect(del.statusCode).toBe(404);
    });
  });
});
