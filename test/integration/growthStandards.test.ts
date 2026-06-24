import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import {
  clearChildrenAndGrowth,
  createOtherUsersChild,
} from "../support/helpers.js";

let app: FastifyInstance;
let childId: string;

beforeAll(async () => {
  app = buildApp({ logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await clearChildrenAndGrowth();
  // 性別 male の子供を用意（seed のマスタは male/female 両方ある）
  const child = await app.inject({
    method: "POST",
    url: "/children",
    payload: { name: "テスト児", birthday: "2024-01-01", gender: "male" },
  });
  childId = child.json().id;
});

describe("growth-standards API", () => {
  it("GET /children/:childId/growth-standards → 子の性別の身長・体重の帯を返す", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/children/${childId}/growth-standards`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    // 出典・性別・身長/体重の帯が含まれる
    expect(body.source).toContain("こども家庭庁");
    expect(body.gender).toBe("male");
    expect(body.height.length).toBeGreaterThan(0);
    expect(body.weight.length).toBeGreaterThan(0);
    // 帯データは月齢・下限・上限を持つ
    expect(body.height[0]).toMatchObject({
      ageMonths: expect.any(Number),
      min: expect.any(Number),
      max: expect.any(Number),
    });
  });

  it("存在しない childId は 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/children/999999/growth-standards",
    });
    expect(res.statusCode).toBe(404);
  });

  it("他人の子の発育曲線は 404", async () => {
    const otherId = await createOtherUsersChild();

    const res = await app.inject({
      method: "GET",
      url: `/children/${otherId}/growth-standards`,
    });
    expect(res.statusCode).toBe(404);
  });
});
