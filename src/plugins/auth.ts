import type { FastifyInstance } from "fastify";
import { authenticate, AuthError } from "../middleware/authenticate.js";
import { AUTH_MODE_DUMMY, PUBLIC_PATHS } from "../config/auth.js";

/**
 * 全エンドポイントをログイン必須にする認証フックをグローバル適用する。
 * 運用系（PUBLIC_PATHS）のみ除外し、未認証リクエストは一律 401 を返す。
 * @param fastify ルートの Fastify インスタンス
 */
export function registerAuth(fastify: FastifyInstance): void {
  // 本番でのダミー認証は全リクエストの認証バイパスになるため、起動を止める。
  if (
    process.env.NODE_ENV === "production" &&
    process.env.AUTH_MODE === AUTH_MODE_DUMMY
  ) {
    throw new Error(
      "本番環境（NODE_ENV=production）で AUTH_MODE=dummy は使用できません"
    );
  }

  // req.user のスロットを確保する。実際の値は onRequest フックで詰める。
  fastify.decorateRequest("user");

  fastify.addHook("onRequest", async (request, reply) => {
    const path = request.routeOptions.url ?? request.url;
    if (PUBLIC_PATHS.includes(path)) return;

    try {
      request.user = await authenticate(request);
    } catch (error) {
      if (error instanceof AuthError) {
        return reply.code(401).send({ error: error.message });
      }
      throw error;
    }
  });
}
