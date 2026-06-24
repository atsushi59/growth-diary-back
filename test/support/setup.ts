import { inject } from "vitest";

// テストは globalSetup で起動した DynamoDB Local へ接続し、ダミー認証で動かす。
// DynamoDB クライアントは import 時に endpoint/credentials を読むため、テストの import より前に設定する。
process.env.DYNAMODB_ENDPOINT = inject("dynamodbEndpoint");
process.env.AWS_REGION = "ap-northeast-1";
process.env.AWS_ACCESS_KEY_ID = "dummy";
process.env.AWS_SECRET_ACCESS_KEY = "dummy";
process.env.AUTH_MODE = "dummy";
