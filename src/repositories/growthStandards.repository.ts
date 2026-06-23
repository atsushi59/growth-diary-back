import { prisma } from "../plugins/prisma.js";

/**
 * 指定した性別の発育曲線マスタを月齢の昇順で取得する。
 * @param gender 性別（"male" / "female"）
 * @returns growth_standards レコードの配列（ageMonths 昇順）
 */
export function findStandardsByGender(gender: string) {
  return prisma.growthStandard.findMany({
    where: { gender },
    orderBy: { ageMonths: "asc" },
  });
}
