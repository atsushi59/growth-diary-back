import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { TABLES } from "../../src/config/dynamodb.js";
import { ddb } from "../../src/plugins/dynamodb.js";
import { createChild } from "../../src/repositories/children.repository.js";
import { upsertUserByCognitoSub } from "../../src/repositories/users.repository.js";
import { batchWrite } from "../../src/utils/batchWrite.js";

let counter = 0;

/**
 * ダミーユーザーとは別のユーザーと、その子供を1件作成して childId を返す。
 * 所有権チェック（他人の子は 404）のテストで使う。
 * @returns 別ユーザーが所有する子供の id
 */
export async function createOtherUsersChild(): Promise<string> {
  counter += 1;
  const cognitoSub = `other-${counter}-${Date.now()}`;

  await upsertUserByCognitoSub({
    cognitoSub,
    name: "他人",
    email: `${cognitoSub}@example.test`,
  });
  const child = await createChild({
    userId: cognitoSub,
    name: "他人の子",
    birthday: "2024-01-01",
    gender: "female",
  });

  return child.id;
}

/**
 * 指定テーブルの全アイテムを削除する（テスト間の後始末用）。
 * @param tableName 対象テーブル名
 * @param keyAttrs プライマリキーの属性名（PK・SK）
 */
async function clearTable(tableName: string, keyAttrs: string[]): Promise<void> {
  const result = await ddb.send(new ScanCommand({ TableName: tableName }));
  const items = result.Items ?? [];
  if (items.length === 0) return;

  await batchWrite(
    tableName,
    items.map((item) => ({
      DeleteRequest: {
        Key: Object.fromEntries(keyAttrs.map((key) => [key, item[key]])),
      },
    }))
  );
}

/** テスト間の後始末: children と growth を全削除する（マスタとユーザーは残す）。 */
export async function clearChildrenAndGrowth(): Promise<void> {
  await clearTable(TABLES.children, ["userId", "id"]);
  await clearTable(TABLES.growth, ["childId", "id"]);
}
