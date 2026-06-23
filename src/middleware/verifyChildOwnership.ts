import type { FastifyReply, FastifyRequest } from "fastify";
import type { Child } from "../../generated/prisma/client.js";
import { findChildByIdForUser } from "../repositories/children.repository.js";

/**
 * URL の :childId が認証ユーザー本人の子供かを確認し、本人の子供なら返す。
 * 他人の子供・存在しない ID は 404 を送って null を返す（存在自体を隠すため 403 ではなく 404）。
 * growth / growth-standards の各エンドポイント冒頭で共通の所有チェックとして使う。
 * @param request 受信リクエスト（params.childId と user を持つ）
 * @param reply 所有チェック失敗時の 404 応答に使う reply
 * @returns 本人の子供なら Child、そうでなければ null（呼び出し側は null なら処理を中断する）
 */
export async function verifyChildOwnership(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<Child | null> {
  const childId = Number((request.params as { childId: string }).childId);

  const child = await findChildByIdForUser(childId, request.user.id);
  if (!child) {
    reply.code(404).send({ error: "Child not found" });
    return null;
  }

  return child;
}
