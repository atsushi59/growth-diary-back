import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../plugins/prisma.js";

/**
 * 指定した子供の成長記録を古い順で取得する。
 * @param childId 子供の id
 * @returns growth レコードの配列（recordedAt 昇順）
 */
export function findGrowthsByChild(childId: number) {
  return prisma.growth.findMany({
    where: { childId },
    orderBy: { recordedAt: "asc" },
  });
}

/**
 * 成長記録を1件作成する。
 * @param input 作成する成長記録（対象の子込み）
 * @returns 作成した growth レコード
 */
export function createGrowth(input: {
  childId: number;
  height: number | null;
  weight: number | null;
  recordedAt: Date;
}) {
  return prisma.growth.create({ data: input });
}

/**
 * その子の成長記録を更新する（where に childId を含め、他の子の記録は更新できない）。
 * 対象が無ければ Prisma が P2025 を投げる。
 * @param growthId 成長記録の id
 * @param childId 対象の子供の id
 * @param data 更新内容
 * @returns 更新後の growth レコード
 */
export function updateGrowthForChild(
  growthId: number,
  childId: number,
  data: Prisma.GrowthUpdateInput
) {
  return prisma.growth.update({ where: { id: growthId, childId }, data });
}

/**
 * その子の成長記録を削除する。対象が無ければ P2025 を投げる。
 * @param growthId 成長記録の id
 * @param childId 対象の子供の id
 */
export function deleteGrowthForChild(growthId: number, childId: number) {
  return prisma.growth.delete({ where: { id: growthId, childId } });
}
