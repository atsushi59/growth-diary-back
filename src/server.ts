import "dotenv/config";
import Fastify from "fastify";
import { registerAuth } from "./plugins/auth.js";
import childrenRoutes from "./routes/children.route.js";
import growthRoutes from "./routes/growth.route.js";
import growthStandardsRoutes from "./routes/growthStandards.route.js";

const fastify = Fastify({
  logger: true,
});

export default fastify;

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
// fastify.register(usersRoutes, { prefix: "/users" });

// サーバー起動
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    // コンテナ外からアクセスできるよう 0.0.0.0 で待ち受ける
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`サーバー起動: http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// AWS Lambda環境以外の場合のみ、常駐サーバーを起動する
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  start();
}
