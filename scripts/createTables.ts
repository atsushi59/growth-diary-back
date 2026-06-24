import {
  CreateTableCommand,
  DynamoDBClient,
  type KeySchemaElement,
  ResourceInUseException,
} from "@aws-sdk/client-dynamodb";
import { TABLES } from "../src/config/dynamodb.js";

// ローカル/テストの DynamoDB Local 用にテーブルを作成するスクリプト。
// 本番（Lambda）は SAM(template.yaml)がテーブルを作るので、このスクリプトは使わない。
const client = new DynamoDBClient(
  process.env.DYNAMODB_ENDPOINT
    ? { endpoint: process.env.DYNAMODB_ENDPOINT }
    : {}
);

// [属性名, キー種別] の配列でテーブルのキー構成を定義する。
const tableKeys: { tableName: string; keys: [string, "HASH" | "RANGE"][] }[] = [
  { tableName: TABLES.users, keys: [["cognitoSub", "HASH"]] },
  { tableName: TABLES.children, keys: [["userId", "HASH"], ["id", "RANGE"]] },
  { tableName: TABLES.growth, keys: [["childId", "HASH"], ["id", "RANGE"]] },
  {
    tableName: TABLES.growthStandards,
    keys: [["gender", "HASH"], ["metricAge", "RANGE"]],
  },
];

/** 4テーブルを作成する（既に存在すればスキップ＝冪等）。 */
async function main() {
  for (const { tableName, keys } of tableKeys) {
    try {
      await client.send(
        new CreateTableCommand({
          TableName: tableName,
          BillingMode: "PAY_PER_REQUEST",
          AttributeDefinitions: keys.map(([name]) => ({
            AttributeName: name,
            AttributeType: "S",
          })),
          KeySchema: keys.map(
            ([name, type]): KeySchemaElement => ({
              AttributeName: name,
              KeyType: type,
            })
          ),
        })
      );
      console.log(`created: ${tableName}`);
    } catch (error) {
      if (error instanceof ResourceInUseException) {
        console.log(`exists : ${tableName}`);
      } else {
        throw error;
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
