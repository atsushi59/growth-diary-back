import type { GrowthStandard } from "../types/models.js";
import { GROWTH_STANDARD_SOURCE } from "../config/growth.js";
import * as growthStandardsRepository from "../repositories/growthStandards.repository.js";

/**
 * マスタ1件をグラフ用の帯データ（月齢・下限・上限）に変換する。
 * @param standard growth_standards のレコード
 * @returns グラフ描画に必要な項目だけに絞ったオブジェクト
 */
function toBand(standard: GrowthStandard) {
  return { ageMonths: standard.ageMonths, min: standard.min, max: standard.max };
}

/**
 * その子の性別に合った発育曲線マスタ（身長・体重の帯）を出典付きで返す。
 * @param gender 子供の性別
 * @returns 出典・性別・身長/体重の帯データ
 */
export async function getStandardsForChild(gender: string) {
  const standards = await growthStandardsRepository.findStandardsByGender(gender);

  return {
    source: GROWTH_STANDARD_SOURCE,
    gender,
    height: standards.filter((s) => s.metric === "height").map(toBand),
    weight: standards.filter((s) => s.metric === "weight").map(toBand),
  };
}
