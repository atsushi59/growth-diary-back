import { randomUUID } from "node:crypto";
import {
  DeleteCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { TABLES } from "../config/dynamodb.js";
import { ddb } from "../plugins/dynamodb.js";
import type { Growth } from "../types/models.js";
import { batchWrite } from "../utils/batchWrite.js";
import { isConditionalCheckFailed } from "../utils/dynamoError.js";

/**
 * 指定した子供の成長記録を recordedAt 昇順で取得する（PK=childId の Query 後に並べ替え）。
 * @param childId 子供の id
 * @returns 成長記録の配列（古い順）
 */
export async function findGrowthsByChild(childId: string): Promise<Growth[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLES.growth,
      KeyConditionExpression: "childId = :childId",
      ExpressionAttributeValues: { ":childId": childId },
    })
  );
  const growths = (result.Items as Growth[]) ?? [];
  // SK は id なので順序は保証されない。recordedAt（ISO文字列）で昇順に並べ替える。
  return growths.sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : 1));
}

/**
 * 成長記録を1件作成する（id は UUID で採番。PK=childId, SK=id）。
 * @param input 作成する成長記録（対象の子の id 込み）
 * @returns 作成した成長記録
 */
export async function createGrowth(input: {
  childId: string;
  height: number | null;
  weight: number | null;
  recordedAt: string;
}): Promise<Growth> {
  const growth: Growth = {
    id: randomUUID(),
    childId: input.childId,
    height: input.height,
    weight: input.weight,
    recordedAt: input.recordedAt,
  };

  await ddb.send(new PutCommand({ TableName: TABLES.growth, Item: growth }));
  return growth;
}

/**
 * その子の成長記録を更新する。対象が無ければ（別の子・不存在）null を返す。
 * @param id 成長記録の id
 * @param childId 対象の子供の id
 * @param data 更新するフィールド（渡されたものだけ更新。null は値のクリア）
 * @returns 更新後の成長記録。対象が無ければ null
 */
export async function updateGrowthForChild(
  id: string,
  childId: string,
  data: { height?: number | null; weight?: number | null; recordedAt?: string }
): Promise<Growth | null> {
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const assignments: string[] = [];
  Object.entries(data).forEach(([key, value], index) => {
    if (value === undefined) return;
    names[`#k${index}`] = key;
    values[`:v${index}`] = value;
    assignments.push(`#k${index} = :v${index}`);
  });

  try {
    const result = await ddb.send(
      new UpdateCommand({
        TableName: TABLES.growth,
        Key: { childId, id },
        UpdateExpression: `SET ${assignments.join(", ")}`,
        ConditionExpression: "attribute_exists(id)", // 無ければ失敗 → 404
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW",
      })
    );
    return result.Attributes as Growth;
  } catch (error) {
    if (isConditionalCheckFailed(error)) return null;
    throw error;
  }
}

/**
 * その子の成長記録を削除する。対象が無ければ false を返す。
 * @param id 成長記録の id
 * @param childId 対象の子供の id
 * @returns 削除できたら true、対象が無ければ false
 */
export async function deleteGrowthForChild(
  id: string,
  childId: string
): Promise<boolean> {
  try {
    await ddb.send(
      new DeleteCommand({
        TableName: TABLES.growth,
        Key: { childId, id },
        ConditionExpression: "attribute_exists(id)",
      })
    );
    return true;
  } catch (error) {
    if (isConditionalCheckFailed(error)) return false;
    throw error;
  }
}

/**
 * 指定した子供の成長記録をすべて削除する（子の削除に伴うカスケード用）。
 * DynamoDB には FK のカスケードが無いため、Query で集めて BatchWrite で消す。
 * @param childId 対象の子供の id
 */
export async function deleteAllGrowthsByChild(childId: string): Promise<void> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLES.growth,
      KeyConditionExpression: "childId = :childId",
      ExpressionAttributeValues: { ":childId": childId },
    })
  );
  const growths = (result.Items as { id: string }[]) ?? [];

  await batchWrite(
    TABLES.growth,
    growths.map((growth) => ({
      DeleteRequest: { Key: { childId, id: growth.id } },
    }))
  );
}
