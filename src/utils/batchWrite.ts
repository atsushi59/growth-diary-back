import {
  BatchWriteCommand,
  type BatchWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { ddb } from "../plugins/dynamodb.js";

// BatchWrite は1回あたり最大25件まで。
const BATCH_SIZE = 25;
// スロットリングで未処理が残ったときの最大再送回数。
const MAX_RETRIES = 5;

type WriteRequest = NonNullable<
  BatchWriteCommandInput["RequestItems"]
>[string][number];

/** 指数バックオフで待つ。 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 1テーブルへの BatchWrite を25件ずつに分割して送る。
 * スロットリングで返る UnprocessedItems を指数バックオフで再送し、取りこぼしを防ぐ。
 * @param tableName 対象テーブル名
 * @param requests PutRequest / DeleteRequest の配列
 */
export async function batchWrite(
  tableName: string,
  requests: WriteRequest[]
): Promise<void> {
  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    let pending: WriteRequest[] = requests.slice(i, i + BATCH_SIZE);

    for (let attempt = 0; pending.length > 0; attempt++) {
      const result = await ddb.send(
        new BatchWriteCommand({ RequestItems: { [tableName]: pending } })
      );

      const unprocessed = result.UnprocessedItems?.[tableName] ?? [];
      if (unprocessed.length === 0) break;
      if (attempt >= MAX_RETRIES) {
        throw new Error(
          `BatchWrite で未処理アイテムが残りました (${tableName}, ${unprocessed.length} 件)`
        );
      }

      pending = unprocessed;
      await delay(2 ** attempt * 50);
    }
  }
}
