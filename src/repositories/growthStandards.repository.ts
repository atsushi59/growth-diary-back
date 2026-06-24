import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { TABLES } from "../config/dynamodb.js";
import { ddb } from "../plugins/dynamodb.js";
import type { GrowthStandard } from "../types/models.js";

/**
 * 指定した性別の発育曲線マスタを取得する（PK=gender の Query）。
 * @param gender 性別（"male" / "female"）
 * @returns 発育曲線マスタの配列
 */
export async function findStandardsByGender(
  gender: string
): Promise<GrowthStandard[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLES.growthStandards,
      KeyConditionExpression: "gender = :gender",
      ExpressionAttributeValues: { ":gender": gender },
    })
  );
  return (result.Items as GrowthStandard[]) ?? [];
}
