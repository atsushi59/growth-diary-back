import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// DYNAMODB_ENDPOINT があればそこへ接続（ローカル/テストの DynamoDB Local）。
// Lambda 等の本番では未設定で、SDK が実 DynamoDB に接続する。
const client = new DynamoDBClient(
  process.env.DYNAMODB_ENDPOINT
    ? { endpoint: process.env.DYNAMODB_ENDPOINT }
    : {}
);

// DocumentClient は JS のオブジェクト⇄DynamoDB の型変換を自動でやってくれるラッパー。
export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});
