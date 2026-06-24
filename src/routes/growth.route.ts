import type { FastifyPluginAsync } from "fastify";
import { verifyChildOwnership } from "../middleware/verifyChildOwnership.js";
import * as growthService from "../services/growth.service.js";
import type { GrowthInput } from "../services/growth.service.js";

const growthRoutes: FastifyPluginAsync = async (fastify) => {
  // Read 一覧  GET /children/:childId/growth（古い順＝成長の推移を見るため）
  fastify.get("/", async (request, reply) => {
    const child = await verifyChildOwnership(request, reply);
    if (!child) return reply;

    const growths = await growthService.listGrowths(child.id);
    return reply.send(growths);
  });

  // Create  POST /children/:childId/growth
  fastify.post<{ Body: GrowthInput }>("/", async (request, reply) => {
    const child = await verifyChildOwnership(request, reply);
    if (!child) return reply;

    const error = growthService.validateFullInput(request.body);
    if (error) return reply.code(400).send({ error });

    const growth = await growthService.createGrowth(child.id, request.body);
    return reply.code(201).send(growth);
  });

  // Update 全置換  PUT /children/:childId/growth/:id
  fastify.put<{ Params: { childId: string; id: string }; Body: GrowthInput }>(
    "/:id",
    async (request, reply) => {
      const child = await verifyChildOwnership(request, reply);
      if (!child) return reply;

      const error = growthService.validateFullInput(request.body);
      if (error) return reply.code(400).send({ error });

      const growth = await growthService.replaceGrowth(
        request.params.id,
        child.id,
        request.body
      );
      if (!growth) {
        return reply.code(404).send({ error: "Growth not found" });
      }
      return reply.send(growth);
    }
  );

  // Update 部分更新  PATCH /children/:childId/growth/:id
  fastify.patch<{
    Params: { childId: string; id: string };
    Body: Partial<GrowthInput>;
  }>("/:id", async (request, reply) => {
    const child = await verifyChildOwnership(request, reply);
    if (!child) return reply;

    const error = growthService.validatePartialInput(request.body);
    if (error) return reply.code(400).send({ error });

    const growth = await growthService.updateGrowth(
      request.params.id,
      child.id,
      request.body
    );
    if (!growth) {
      return reply.code(404).send({ error: "Growth not found" });
    }
    return reply.send(growth);
  });

  // Delete  DELETE /children/:childId/growth/:id
  fastify.delete<{ Params: { childId: string; id: string } }>(
    "/:id",
    async (request, reply) => {
      const child = await verifyChildOwnership(request, reply);
      if (!child) return reply;

      const deleted = await growthService.deleteGrowth(
        request.params.id,
        child.id
      );
      if (!deleted) {
        return reply.code(404).send({ error: "Growth not found" });
      }
      return reply.send({ message: "Growth deleted successfully" });
    }
  );
};

export default growthRoutes;
