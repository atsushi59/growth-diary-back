import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { registerAuth } from "./plugins/auth.js";
import childrenRoutes from "./routes/children.route.js";
import growthRoutes from "./routes/growth.route.js";
import growthStandardsRoutes from "./routes/growthStandards.route.js";
import uploadsRoutes from "./routes/uploads.route.js";

// ローカル開発のフロント（Vite）のオリジン。本番ドメインの許可は #25 で対応する。
const LOCAL_FRONTEND_ORIGIN = "http://localhost:5173";

/**
 * Fastify アプリを組み立てて返す（listen はしない）。
 * 本番は server.ts が listen し、テストは .inject() でこのインスタンスを直接叩く。
 * @param options logger の有効/無効（テストでは false にしてログを抑制）
 * @returns ルート・認証フックを登録済みの Fastify インスタンス
 */
export function buildApp(options: { logger?: boolean } = {}): FastifyInstance {
  const fastify = Fastify({ logger: options.logger ?? true });

  // CORS は認証フック・ルートより先に登録する。
  // プリフライト（OPTIONS）が認証で弾かれず、エラー応答にも CORS ヘッダが付くようにするため。
  fastify.register(cors, { origin: LOCAL_FRONTEND_ORIGIN });

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
  // 画像アップロード用の署名付き URL 発行（用途共通）
  fastify.register(uploadsRoutes, { prefix: "/uploads" });

  return fastify;
}
