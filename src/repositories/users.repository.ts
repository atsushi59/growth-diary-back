import type { User } from "../../generated/prisma/client.js";
import { prisma } from "../plugins/prisma.js";

/**
 * cognito_sub でユーザーを upsert する（あれば取得、無ければ作成）。
 * upsert なので初回アクセスが同時に複数届いても unique 制約違反にならない。
 * 既存ユーザーは update:{} で変更しない（後からプロフィール同期で更新される値を保持する）。
 * @param input 作成時に使う cognito_sub / 表示名 / メール
 * @returns 既存または新規作成した users レコード
 */
export function upsertUserByCognitoSub(input: {
  cognitoSub: string;
  name: string;
  email: string;
}): Promise<User> {
  return prisma.user.upsert({
    where: { cognitoSub: input.cognitoSub },
    update: {},
    create: input,
  });
}
