import { prisma } from "../../src/plugins/prisma.js";

let counter = 0;

/**
 * ダミーユーザーとは別のユーザーと、その子供を1件作成して childId を返す。
 * 所有権チェック（他人の子は 404）のテストで使う。
 * @returns 別ユーザーが所有する子供の id
 */
export async function createOtherUsersChild(): Promise<number> {
  counter += 1;
  const unique = `other-${counter}-${Date.now()}`;

  const user = await prisma.user.create({
    data: { cognitoSub: unique, name: "他人", email: `${unique}@example.test` },
  });
  const child = await prisma.child.create({
    data: {
      userId: user.id,
      name: "他人の子",
      birthday: new Date("2024-01-01"),
      gender: "female",
    },
  });

  return child.id;
}
