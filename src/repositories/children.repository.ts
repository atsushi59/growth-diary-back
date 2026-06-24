import { randomUUID } from "node:crypto";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { TABLES } from "../config/dynamodb.js";
import { ddb } from "../plugins/dynamodb.js";
import type { Child } from "../types/models.js";
import { isConditionalCheckFailed } from "../utils/dynamoError.js";

/**
 * 子供を1件作成する（id は UUID で採番。PK=userId, SK=id）。
 * @param input 作成する子供のデータ（所有ユーザーの cognitoSub 込み）
 * @returns 作成した子供
 */
export async function createChild(input: {
  userId: string;
  name: string;
  birthday: string;
  gender: string;
}): Promise<Child> {
  const now = new Date().toISOString();
  const child: Child = {
    id: randomUUID(),
    userId: input.userId,
    name: input.name,
    birthday: input.birthday,
    gender: input.gender,
    createdAt: now,
    updatedAt: now,
  };

  await ddb.send(new PutCommand({ TableName: TABLES.children, Item: child }));
  return child;
}

/**
 * 指定ユーザーの子供を全件取得する（PK=userId の Query）。
 * @param userId 所有ユーザーの cognitoSub
 * @returns 子供の配列
 */
export async function findChildrenByUser(userId: string): Promise<Child[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLES.children,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
    })
  );
  return (result.Items as Child[]) ?? [];
}

/**
 * 本人の子供を1件取得する（キー {userId, id} の GetItem なので他人の子はヒットしない）。
 * @param id 子供の id
 * @param userId 所有ユーザーの cognitoSub
 * @returns 子供。無ければ null
 */
export async function findChildByIdForUser(
  id: string,
  userId: string
): Promise<Child | null> {
  const result = await ddb.send(
    new GetCommand({ TableName: TABLES.children, Key: { userId, id } })
  );
  return (result.Item as Child) ?? null;
}

/**
 * 本人の子供を更新する。対象が無ければ（他人の子・不存在）null を返す。
 * @param id 子供の id
 * @param userId 所有ユーザーの cognitoSub
 * @param data 更新するフィールド（渡されたものだけ更新）
 * @returns 更新後の子供。対象が無ければ null
 */
export async function updateChildForUser(
  id: string,
  userId: string,
  data: { name?: string; birthday?: string; gender?: string }
): Promise<Child | null> {
  const fields: Record<string, unknown> = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const assignments: string[] = [];
  Object.entries(fields).forEach(([key, value], index) => {
    if (value === undefined) return;
    names[`#k${index}`] = key;
    values[`:v${index}`] = value;
    assignments.push(`#k${index} = :v${index}`);
  });

  try {
    const result = await ddb.send(
      new UpdateCommand({
        TableName: TABLES.children,
        Key: { userId, id },
        UpdateExpression: `SET ${assignments.join(", ")}`,
        ConditionExpression: "attribute_exists(id)", // 無ければ失敗 → 404
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW",
      })
    );
    return result.Attributes as Child;
  } catch (error) {
    if (isConditionalCheckFailed(error)) return null;
    throw error;
  }
}

/**
 * 本人の子供を削除する。対象が無ければ false を返す。
 * @param id 子供の id
 * @param userId 所有ユーザーの cognitoSub
 * @returns 削除できたら true、対象が無ければ false
 */
export async function deleteChildForUser(
  id: string,
  userId: string
): Promise<boolean> {
  try {
    await ddb.send(
      new DeleteCommand({
        TableName: TABLES.children,
        Key: { userId, id },
        ConditionExpression: "attribute_exists(id)",
      })
    );
    return true;
  } catch (error) {
    if (isConditionalCheckFailed(error)) return false;
    throw error;
  }
}
