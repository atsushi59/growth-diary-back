import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/support/globalSetup.ts"],
    setupFiles: ["./test/support/setup.ts"],
    // 1つの PostgreSQL コンテナを共有するため、テストファイルの並列実行は無効化する
    fileParallelism: false,
    testTimeout: 30000,
    // コンテナ起動・マイグレーションは時間がかかるためフックのタイムアウトを延ばす
    hookTimeout: 120000,
  },
});
