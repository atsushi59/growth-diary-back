import { execSync } from "node:child_process";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";

let container: StartedPostgreSqlContainer;

/**
 * 全テストの前に1回だけ実行。本物の PostgreSQL コンテナを起動し、
 * マイグレーション適用と seed 投入を済ませてから、接続先を各ワーカーへ渡す。
 * @param project vitest のテストプロジェクト（provide で値を共有できる）
 */
export async function setup(project: TestProject) {
  container = await new PostgreSqlContainer("postgres:16").start();
  const databaseUrl = container.getConnectionUri();

  const env = { ...process.env, DATABASE_URL: databaseUrl };
  // マイグレーション適用 → seed（発育曲線マスタ・ダミーユーザー）投入
  execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit" });

  // 各テストワーカーが同じコンテナへ接続できるよう接続先を共有する
  project.provide("databaseUrl", databaseUrl);
}

/** 全テスト終了後にコンテナを停止する。 */
export async function teardown() {
  await container?.stop();
}

declare module "vitest" {
  interface ProvidedContext {
    databaseUrl: string;
  }
}
