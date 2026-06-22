import "dotenv/config";
import Fastify from "fastify";
import { registerAuth } from "./auth/registerAuth.js";
import childrenRoutes from "./routes/children.js";

const fastify = Fastify({
  logger: true,
});

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
// fastify.register(growthRoutes, { prefix: "/growth" });
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

start();
