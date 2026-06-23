import type { FastifyPluginAsync } from "fastify";
import { verifyChildOwnership } from "../middleware/verifyChildOwnership.js";
import * as growthStandardsService from "../services/growthStandards.service.js";

const growthStandardsRoutes: FastifyPluginAsync = async (fastify) => {
  // Read  GET /children/:childId/growth-standards
  // その子の性別でサーバー側フィルタし、身長・体重両方の帯を返す（グラフの背景用）
  fastify.get("/", async (request, reply) => {
    const child = await verifyChildOwnership(request, reply);
    if (!child) return reply;

    const standards = await growthStandardsService.getStandardsForChild(
      child.gender
    );
    return reply.send(standards);
  });
};

export default growthStandardsRoutes;
