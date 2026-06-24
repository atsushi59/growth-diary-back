import { execSync } from "node:child_process";
import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from "testcontainers";
import type { TestProject } from "vitest/node";

let container: StartedTestContainer;

/**
 * 全テストの前に1回だけ実行。DynamoDB Local コンテナを起動し、
 * テーブル作成と seed 投入を済ませてから、接続先(endpoint)を各ワーカーへ渡す。
 * @param project vitest のテストプロジェクト（provide で値を共有できる）
 */
export async function setup(project: TestProject) {
  container = await new GenericContainer("amazon/dynamodb-local:latest")
    .withExposedPorts(8000)
    .withCommand(["-jar", "DynamoDBLocal.jar", "-inMemory", "-sharedDb"])
    .withWaitStrategy(Wait.forListeningPorts())
    .start();

  const endpoint = `http://${container.getHost()}:${container.getMappedPort(8000)}`;

  const env = {
    ...process.env,
    DYNAMODB_ENDPOINT: endpoint,
    AWS_REGION: "ap-northeast-1",
    AWS_ACCESS_KEY_ID: "dummy",
    AWS_SECRET_ACCESS_KEY: "dummy",
  };
  // テーブル作成 → seed（発育曲線マスタ・ダミーユーザー）投入
  execSync("npx tsx scripts/createTables.ts", { env, stdio: "inherit" });
  execSync("npx tsx scripts/seed.ts", { env, stdio: "inherit" });

  // 各テストワーカーが同じコンテナへ接続できるよう接続先を共有する
  project.provide("dynamodbEndpoint", endpoint);
}

/** 全テスト終了後にコンテナを停止する。 */
export async function teardown() {
  await container?.stop();
}

declare module "vitest" {
  interface ProvidedContext {
    dynamodbEndpoint: string;
  }
}
