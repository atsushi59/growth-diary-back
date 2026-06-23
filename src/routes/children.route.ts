import type { FastifyPluginAsync } from "fastify";
import { isRecordNotFoundError } from "../utils/prismaError.js";
import * as childrenService from "../services/children.service.js";
import type { ChildInput } from "../services/children.service.js";

const childrenRoutes: FastifyPluginAsync = async (fastify) => {
  // Create  POST /children
  fastify.post<{ Body: ChildInput }>("/", async (request, reply) => {
    const child = await childrenService.createChild(request.user.id, request.body);
    return reply.code(201).send(child);
  });

  // Read 一覧  GET /children（本人の子供のみ）
  fastify.get("/", async (request, reply) => {
    const children = await childrenService.listChildren(request.user.id);
    return reply.send(children);
  });

  // Read 1件  GET /children/:id
  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const child = await childrenService.getChild(
      Number(request.params.id),
      request.user.id
    );
    if (!child) {
      return reply.code(404).send({ error: "Child not found" });
    }
    return reply.send(child);
  });

  // Delete  DELETE /children/:id
  fastify.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    try {
      await childrenService.deleteChild(Number(request.params.id), request.user.id);
      return reply.send({ message: "Child deleted successfully" });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return reply.code(404).send({ error: "Child not found" });
      }
      throw error;
    }
  });

  // Update 全置換  PUT /children/:id
  fastify.put<{ Params: { id: string }; Body: ChildInput }>(
    "/:id",
    async (request, reply) => {
      try {
        const child = await childrenService.replaceChild(
          Number(request.params.id),
          request.user.id,
          request.body
        );
        return reply.send(child);
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          return reply.code(404).send({ error: "Child not found" });
        }
        throw error;
      }
    }
  );

  // Update 部分更新  PATCH /children/:id
  fastify.patch<{ Params: { id: string }; Body: Partial<ChildInput> }>(
    "/:id",
    async (request, reply) => {
      try {
        const child = await childrenService.updateChild(
          Number(request.params.id),
          request.user.id,
          request.body
        );
        return reply.send(child);
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          return reply.code(404).send({ error: "Child not found" });
        }
        throw error;
      }
    }
  );
};

export default childrenRoutes;
