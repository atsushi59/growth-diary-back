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
  image?: string;
}): Promise<Child> {
  const now = new Date().toISOString();
  const child: Child = {
    id: randomUUID(),
    userId: input.userId,
    name: input.name,
    birthday: input.birthday,
    gender: input.gender,
    image: input.image, // undefined は marshallOptions の removeUndefinedValues で除外される
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
 * 更新後の子供と、更新前の image（差し替え時の S3 後始末用）を返す。
 * @returns { child: 更新後の子供, previousImage: 更新前の image }。対象が無ければ null
 */
export async function updateChildForUser(
  id: string,
  userId: string,
  data: { name?: string; birthday?: string; gender?: string; image?: string }
): Promise<{ child: Child; previousImage?: string } | null> {
  const updatedAt = new Date().toISOString();
  const fields: Record<string, unknown> = { ...data, updatedAt };
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
    // ALL_OLD で更新前の状態を取得し、旧 image をアトミックに得る（別途 GET 不要・競合窓も無い）
    const result = await ddb.send(
      new UpdateCommand({
        TableName: TABLES.children,
        Key: { userId, id },
        UpdateExpression: `SET ${assignments.join(", ")}`,
        ConditionExpression: "attribute_exists(id)", // 無ければ失敗 → 404
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_OLD",
      })
    );
    const previous = result.Attributes as Child | undefined;
    if (!previous) return null;

    // 更新後の姿 = 旧アイテムに今回 SET した値（undefined を除く）を上書き
    const child = { ...previous } as Child;
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) (child as Record<string, unknown>)[key] = value;
    });

    return { child, previousImage: previous.image };
  } catch (error) {
    if (isConditionalCheckFailed(error)) return null;
    throw error;
  }
}

/**
 * 本人の子供を削除する。対象が無ければ null を返す。
 * 削除した子供（画像キーの後始末などに使う）を返す。
 * @param id 子供の id
 * @param userId 所有ユーザーの cognitoSub
 * @returns 削除した子供。対象が無ければ null
 */
export async function deleteChildForUser(
  id: string,
  userId: string
): Promise<Child | null> {
  try {
    const result = await ddb.send(
      new DeleteCommand({
        TableName: TABLES.children,
        Key: { userId, id },
        ConditionExpression: "attribute_exists(id)",
        ReturnValues: "ALL_OLD",
      })
    );
    return (result.Attributes as Child) ?? null;
  } catch (error) {
    if (isConditionalCheckFailed(error)) return null;
    throw error;
  }
}
