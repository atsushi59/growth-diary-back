import "dotenv/config";
import { buildApp } from "./app.js";

const fastify = buildApp({ logger: true });

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

// AWS Lambda 環境以外の場合のみ、常駐サーバーを起動する
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  start();
}
