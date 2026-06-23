import type { FastifyPluginAsync } from "fastify";
import { isRecordNotFoundError } from "../utils/prismaError.js";
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

      try {
        const growth = await growthService.replaceGrowth(
          Number(request.params.id),
          child.id,
          request.body
        );
        return reply.send(growth);
      } catch (caughtError) {
        if (isRecordNotFoundError(caughtError)) {
          return reply.code(404).send({ error: "Growth not found" });
        }
        throw caughtError;
      }
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

    try {
      const growth = await growthService.updateGrowth(
        Number(request.params.id),
        child.id,
        request.body
      );
      return reply.send(growth);
    } catch (caughtError) {
      if (isRecordNotFoundError(caughtError)) {
        return reply.code(404).send({ error: "Growth not found" });
      }
      throw caughtError;
    }
  });

  // Delete  DELETE /children/:childId/growth/:id
  fastify.delete<{ Params: { childId: string; id: string } }>(
    "/:id",
    async (request, reply) => {
      const child = await verifyChildOwnership(request, reply);
      if (!child) return reply;

      try {
        await growthService.deleteGrowth(Number(request.params.id), child.id);
        return reply.send({ message: "Growth deleted successfully" });
      } catch (caughtError) {
        if (isRecordNotFoundError(caughtError)) {
          return reply.code(404).send({ error: "Growth not found" });
        }
        throw caughtError;
      }
    }
  );
};

export default growthRoutes;
