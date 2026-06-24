import type { FastifyPluginAsync } from "fastify";
import * as childrenService from "../services/children.service.js";
import type { ChildInput } from "../services/children.service.js";

const childrenRoutes: FastifyPluginAsync = async (fastify) => {
  // Create  POST /children
  fastify.post<{ Body: ChildInput }>("/", async (request, reply) => {
    const child = await childrenService.createChild(
      request.user.cognitoSub,
      request.body
    );
    return reply.code(201).send(child);
  });

  // Read 一覧  GET /children（本人の子供のみ）
  fastify.get("/", async (request, reply) => {
    const children = await childrenService.listChildren(request.user.cognitoSub);
    return reply.send(children);
  });

  // Read 1件  GET /children/:id
  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const child = await childrenService.getChild(
      request.params.id,
      request.user.cognitoSub
    );
    if (!child) {
      return reply.code(404).send({ error: "Child not found" });
    }
    return reply.send(child);
  });

  // Delete  DELETE /children/:id
  fastify.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const deleted = await childrenService.deleteChild(
      request.params.id,
      request.user.cognitoSub
    );
    if (!deleted) {
      return reply.code(404).send({ error: "Child not found" });
    }
    return reply.send({ message: "Child deleted successfully" });
  });

  // Update 全置換  PUT /children/:id
  fastify.put<{ Params: { id: string }; Body: ChildInput }>(
    "/:id",
    async (request, reply) => {
      const child = await childrenService.replaceChild(
        request.params.id,
        request.user.cognitoSub,
        request.body
      );
      if (!child) {
        return reply.code(404).send({ error: "Child not found" });
      }
      return reply.send(child);
    }
  );

  // Update 部分更新  PATCH /children/:id
  fastify.patch<{ Params: { id: string }; Body: Partial<ChildInput> }>(
    "/:id",
    async (request, reply) => {
      const child = await childrenService.updateChild(
        request.params.id,
        request.user.cognitoSub,
        request.body
      );
      if (!child) {
        return reply.code(404).send({ error: "Child not found" });
      }
      return reply.send(child);
    }
  );
};

export default childrenRoutes;
