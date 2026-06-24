import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";

/**
 * DynamoDB の条件付き書き込みが失敗した（＝対象アイテムが存在しなかった）エラーかを判定する。
 * update/delete で対象が無いケースを 404 に振り分けるために使う。
 * @param error catch した例外
 * @returns 条件チェック失敗なら true
 */
export function isConditionalCheckFailed(error: unknown): boolean {
  return error instanceof ConditionalCheckFailedException;
}
