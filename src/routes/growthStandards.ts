import type { FastifyPluginAsync } from "fastify";
import type { GrowthStandard } from "../../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { verifyChildOwnership } from "./verifyChildOwnership.js";

// アプリ内に明記する出典表記
const GROWTH_STANDARD_SOURCE = "出典: こども家庭庁「令和5年乳幼児身体発育調査」";

/**
 * マスタ1件をグラフ用の帯データ（月齢・下限・上限）に変換する。
 * @param standard growth_standards のレコード
 * @returns グラフ描画に必要な項目だけに絞ったオブジェクト
 */
function toBand(standard: GrowthStandard) {
  return { ageMonths: standard.ageMonths, min: standard.min, max: standard.max };
}

const growthStandardsRoutes: FastifyPluginAsync = async (fastify) => {
  // Read  GET /children/:childId/growth-standards
  // その子の性別でサーバー側フィルタし、身長・体重両方の帯を返す（グラフの背景用）
  fastify.get("/", async (request, reply) => {
    const child = await verifyChildOwnership(request, reply);
    if (!child) return reply;

    const standards = await prisma.growthStandard.findMany({
      where: { gender: child.gender },
      orderBy: { ageMonths: "asc" },
    });

    return reply.send({
      source: GROWTH_STANDARD_SOURCE,
      gender: child.gender,
      height: standards.filter((s) => s.metric === "height").map(toBand),
      weight: standards.filter((s) => s.metric === "weight").map(toBand),
    });
  });
};

export default growthStandardsRoutes;
