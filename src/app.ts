import Fastify, { type FastifyInstance } from "fastify";
import { registerAuth } from "./plugins/auth.js";
import childrenRoutes from "./routes/children.route.js";
import growthRoutes from "./routes/growth.route.js";
import growthStandardsRoutes from "./routes/growthStandards.route.js";

/**
 * Fastify アプリを組み立てて返す（listen はしない）。
 * 本番は server.ts が listen し、テストは .inject() でこのインスタンスを直接叩く。
 * @param options logger の有効/無効（テストでは false にしてログを抑制）
 * @returns ルート・認証フックを登録済みの Fastify インスタンス
 */
export function buildApp(options: { logger?: boolean } = {}): FastifyInstance {
  const fastify = Fastify({ logger: options.logger ?? true });

  // 認証フックをグローバル適用（運用系を除く全エンドポイントをログイン必須にする）
  registerAuth(fastify);

  // ヘルスチェック（コンテナの起動確認に使う）
  fastify.get("/", async () => {
    return { message: "growth-diary-back is running" };
  });

  fastify.get("/health", async () => {
    return { status: "ok" };
  });

  // ── テーブルごとのルートをプラグインとして登録 ──
  // 新しいテーブルを追加するときは routes/ にファイルを作り、ここに1行足す
  fastify.register(childrenRoutes, { prefix: "/children" });
  // 成長記録・発育曲線マスタは child 配下にネスト（所有チェックを各ルートで通す）
  fastify.register(growthRoutes, { prefix: "/children/:childId/growth" });
  fastify.register(growthStandardsRoutes, {
    prefix: "/children/:childId/growth-standards",
  });

  return fastify;
}
