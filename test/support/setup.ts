import { inject } from "vitest";

// テストは globalSetup で起動した本物の Postgres コンテナへ接続し、ダミー認証で動かす。
// prisma クライアントは import 時に DATABASE_URL を読むため、テストの import より前にここで設定する。
process.env.DATABASE_URL = inject("databaseUrl");
process.env.AUTH_MODE = "dummy";
