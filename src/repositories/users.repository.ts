import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { TABLES } from "../config/dynamodb.js";
import { ddb } from "../plugins/dynamodb.js";
import type { User } from "../types/models.js";

/**
 * cognito_sub でユーザーを upsert する（あれば取得、無ければ作成）。
 * if_not_exists で既存の name/email/createdAt を保持しつつ、無ければその場で作成する（JIT）。
 * @param input 作成時に使う cognito_sub / 表示名 / メール
 * @returns 既存または新規作成したユーザー
 */
export async function upsertUserByCognitoSub(input: {
  cognitoSub: string;
  name: string;
  email: string;
}): Promise<User> {
  const now = new Date().toISOString();

  const result = await ddb.send(
    new UpdateCommand({
      TableName: TABLES.users,
      Key: { cognitoSub: input.cognitoSub },
      // 既存値があれば保持、無ければ渡された値で作成する
      UpdateExpression:
        "SET #name = if_not_exists(#name, :name), email = if_not_exists(email, :email), createdAt = if_not_exists(createdAt, :now)",
      ExpressionAttributeNames: { "#name": "name" },
      ExpressionAttributeValues: {
        ":name": input.name,
        ":email": input.email,
        ":now": now,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  return result.Attributes as User;
}
