import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../plugins/prisma.js";

/**
 * 子供を1件作成する。
 * @param input 作成する子供のデータ（所有ユーザー込み）
 * @returns 作成した children レコード
 */
export function createChild(input: {
  userId: number;
  name: string;
  birthday: Date;
  gender: string;
}) {
  return prisma.child.create({ data: input });
}

/**
 * 指定ユーザーの子供を全件取得する。
 * @param userId 所有ユーザーの id
 * @returns children レコードの配列
 */
export function findChildrenByUser(userId: number) {
  return prisma.child.findMany({ where: { userId } });
}

/**
 * 本人の子供を1件取得する（他人の子はヒットしない）。
 * @param childId 子供の id
 * @param userId 所有ユーザーの id
 * @returns children レコード。無ければ null
 */
export function findChildByIdForUser(childId: number, userId: number) {
  return prisma.child.findFirst({ where: { id: childId, userId } });
}

/**
 * 本人の子供を更新する（where に userId を含め、他人の子は更新できない）。
 * 対象が無ければ Prisma が P2025 を投げる。
 * @param childId 子供の id
 * @param userId 所有ユーザーの id
 * @param data 更新内容
 * @returns 更新後の children レコード
 */
export function updateChildForUser(
  childId: number,
  userId: number,
  data: Prisma.ChildUpdateInput
) {
  return prisma.child.update({ where: { id: childId, userId }, data });
}

/**
 * 本人の子供を削除する（他人の子は削除できない）。対象が無ければ P2025 を投げる。
 * @param childId 子供の id
 * @param userId 所有ユーザーの id
 */
export function deleteChildForUser(childId: number, userId: number) {
  return prisma.child.delete({ where: { id: childId, userId } });
}
