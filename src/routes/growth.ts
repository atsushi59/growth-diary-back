import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { isRecordNotFoundError } from "../prismaError.js";
import { verifyChildOwnership } from "../auth/verifyChildOwnership.js";

// 身長(cm)・体重(kg)の妥当性チェックに使う上限（ありえない値を弾く）
const MAX_HEIGHT_CM = 300;
const MAX_WEIGHT_KG = 300;

// 登録・更新時にクライアントから受け取る入力の型。
// recordedAt は測定日（フロントは YYYY-MM-01 で送る前提）。
type GrowthInput = {
  height?: number | null;
  weight?: number | null;
  recordedAt: string;
};

/**
 * 身長・体重の値が妥当（正の数かつ上限以内）かを判定する。
 * @param value 検証する値
 * @param max 上限
 * @returns 妥当なら true
 */
function isValidMeasurement(value: unknown, max: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= max;
}

/**
 * 登録・全置換（POST/PUT）の入力を検証し、エラーメッセージを返す。
 * @param body クライアントからの入力
 * @returns 問題があればエラーメッセージ、なければ null
 */
function validateFullInput(body: GrowthInput): string | null {
  if (!body.recordedAt || Number.isNaN(new Date(body.recordedAt).getTime())) {
    return "recordedAt は有効な日付で指定してください";
  }

  const hasHeight = body.height !== undefined && body.height !== null;
  const hasWeight = body.weight !== undefined && body.weight !== null;
  if (!hasHeight && !hasWeight) {
    return "height か weight の少なくとも一方は必須です";
  }
  if (hasHeight && !isValidMeasurement(body.height, MAX_HEIGHT_CM)) {
    return `height は 0 より大きく ${MAX_HEIGHT_CM} 以下の数値で指定してください`;
  }
  if (hasWeight && !isValidMeasurement(body.weight, MAX_WEIGHT_KG)) {
    return `weight は 0 より大きく ${MAX_WEIGHT_KG} 以下の数値で指定してください`;
  }
  return null;
}

/**
 * 部分更新（PATCH）の入力を検証し、エラーメッセージを返す。
 * 渡されたフィールドだけを検証する（null は値のクリアとして許可）。
 * @param body クライアントからの入力
 * @returns 問題があればエラーメッセージ、なければ null
 */
function validatePartialInput(body: Partial<GrowthInput>): string | null {
  if (
    body.recordedAt !== undefined &&
    Number.isNaN(new Date(body.recordedAt).getTime())
  ) {
    return "recordedAt は有効な日付で指定してください";
  }
  if (
    body.height !== undefined &&
    body.height !== null &&
    !isValidMeasurement(body.height, MAX_HEIGHT_CM)
  ) {
    return `height は 0 より大きく ${MAX_HEIGHT_CM} 以下の数値で指定してください`;
  }
  if (
    body.weight !== undefined &&
    body.weight !== null &&
    !isValidMeasurement(body.weight, MAX_WEIGHT_KG)
  ) {
    return `weight は 0 より大きく ${MAX_WEIGHT_KG} 以下の数値で指定してください`;
  }
  return null;
}

const growthRoutes: FastifyPluginAsync = async (fastify) => {
  // Read 一覧  GET /children/:childId/growth（古い順＝成長の推移を見るため）
  fastify.get("/", async (request, reply) => {
    const child = await verifyChildOwnership(request, reply);
    if (!child) return reply;

    const growths = await prisma.growth.findMany({
      where: { childId: child.id },
      orderBy: { recordedAt: "asc" },
    });
    return reply.send(growths);
  });

  // Create  POST /children/:childId/growth
  fastify.post<{ Body: GrowthInput }>("/", async (request, reply) => {
    const child = await verifyChildOwnership(request, reply);
    if (!child) return reply;

    const error = validateFullInput(request.body);
    if (error) return reply.code(400).send({ error });

    const growth = await prisma.growth.create({
      data: {
        childId: child.id,
        height: request.body.height ?? null,
        weight: request.body.weight ?? null,
        recordedAt: new Date(request.body.recordedAt),
      },
    });
    return reply.code(201).send(growth);
  });

  // Update 全置換  PUT /children/:childId/growth/:id
  fastify.put<{ Params: { childId: string; id: string }; Body: GrowthInput }>(
    "/:id",
    async (request, reply) => {
      const child = await verifyChildOwnership(request, reply);
      if (!child) return reply;

      const error = validateFullInput(request.body);
      if (error) return reply.code(400).send({ error });

      try {
        const updated = await prisma.growth.update({
          // childId も条件に入れて、その子の記録以外は更新できないようにする
          where: { id: Number(request.params.id), childId: child.id },
          data: {
            height: request.body.height ?? null,
            weight: request.body.weight ?? null,
            recordedAt: new Date(request.body.recordedAt),
          },
        });
        return reply.send(updated);
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

    const error = validatePartialInput(request.body);
    if (error) return reply.code(400).send({ error });

    const data: Prisma.GrowthUpdateInput = {};
    if (request.body.height !== undefined) data.height = request.body.height;
    if (request.body.weight !== undefined) data.weight = request.body.weight;
    if (request.body.recordedAt !== undefined) {
      data.recordedAt = new Date(request.body.recordedAt);
    }

    try {
      const updated = await prisma.growth.update({
        where: { id: Number(request.params.id), childId: child.id },
        data,
      });
      return reply.send(updated);
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
        await prisma.growth.delete({
          where: { id: Number(request.params.id), childId: child.id },
        });
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
