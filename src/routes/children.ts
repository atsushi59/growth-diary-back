import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../prisma.js";

// 登録時にクライアントから受け取る入力の型
type CreateChildInput = {
  userId: number;
  name: string;
  birthday: string; // JSONで届くので文字列
  gender: string;
};

const childrenRoutes: FastifyPluginAsync = async (fastify) => {
  // Create  POST /children
  fastify.post<{ Body: CreateChildInput }>("/", async (request, reply) => {
    const body = request.body;

    const child = await prisma.child.create({
      data: {
        userId: body.userId,
        name: body.name,
        birthday: new Date(body.birthday),
        gender: body.gender,
      },
    });

    return reply.code(201).send(child);
  });

  // Read 一覧  GET /children
  fastify.get("/", async (_request, reply) => {
    const children = await prisma.child.findMany();
    return reply.send(children);
  });

  // Read 1件  GET /children/:id
  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const { id } = request.params;

    const child = await prisma.child.findUnique({
      where: { id: parseInt(id) },
    });

    if (!child) {
      return reply.code(404).send({ error: "Child not found" });
    }

    return reply.send(child);
  });

  // Delete  DELETE /children/:id
  fastify.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const { id } = request.params;

    try {
      await prisma.child.delete({
        where: { id: parseInt(id) },
      });
      return reply.send({ message: "Child deleted successfully" });
    } catch {
      return reply.code(404).send({ error: "Child not found" });
    }
  });

  // Update 全置換  PUT /children/:id
  fastify.put<{ Params: { id: string }; Body: CreateChildInput }>(
    "/:id",
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      try {
        const updatedChild = await prisma.child.update({
          where: { id: parseInt(id) },
          data: {
            userId: body.userId,
            name: body.name,
            birthday: new Date(body.birthday),
            gender: body.gender,
          },
        });
        return reply.send(updatedChild);
      } catch {
        return reply.code(404).send({ error: "Child not found" });
      }
    }
  );

  // Update 部分更新  PATCH /children/:id
  fastify.patch<{ Params: { id: string }; Body: Partial<CreateChildInput> }>(
    "/:id",
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body;

      const data: Prisma.ChildUpdateInput = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.birthday !== undefined) data.birthday = new Date(body.birthday);
      if (body.gender !== undefined) data.gender = body.gender;

      try {
        const updatedChild = await prisma.child.update({
          where: { id: parseInt(id) },
          data,
        });
        return reply.send(updatedChild);
      } catch {
        return reply.code(404).send({ error: "Child not found" });
      }
    }
  );
};

export default childrenRoutes;
