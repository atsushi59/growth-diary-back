import { MAX_HEIGHT_CM, MAX_WEIGHT_KG } from "../config/growth.js";
import * as growthRepository from "../repositories/growth.repository.js";

// 登録・更新時にクライアントから受け取る入力の型。
// recordedAt は測定日（フロントは YYYY-MM-01 で送る前提）。
export type GrowthInput = {
  height?: number | null;
  weight?: number | null;
  recordedAt: string;
};

/**
 * 身長・体重の値が妥当（正の数かつ上限以内）かを判定する。
 * @param value 検証する値
 * @param max 上限
 * @returns 妥当なら true
 */
function isValidMeasurement(value: unknown, max: number): boolean {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= max
  );
}

/**
 * 登録・全置換（POST/PUT）の入力を検証し、エラーメッセージを返す。
 * @param body クライアントからの入力
 * @returns 問題があればエラーメッセージ、なければ null
 */
export function validateFullInput(body: GrowthInput): string | null {
  if (!body.recordedAt || Number.isNaN(new Date(body.recordedAt).getTime())) {
    return "recordedAt は有効な日付で指定してください";
  }

  const hasHeight = body.height !== undefined && body.height !== null;
  const hasWeight = body.weight !== undefined && body.weight !== null;
  if (!hasHeight && !hasWeight) {
    return "height か weight の少なくとも一方は必須です";
  }
  if (hasHeight && !isValidMeasurement(body.height, MAX_HEIGHT_CM)) {
    return `height は 0 より大きく ${MAX_HEIGHT_CM} 以下の数値で指定してください`;
  }
  if (hasWeight && !isValidMeasurement(body.weight, MAX_WEIGHT_KG)) {
    return `weight は 0 より大きく ${MAX_WEIGHT_KG} 以下の数値で指定してください`;
  }
  return null;
}

/**
 * 部分更新（PATCH）の入力を検証し、エラーメッセージを返す。
 * 渡されたフィールドだけを検証する（null は値のクリアとして許可）。
 * @param body クライアントからの入力
 * @returns 問題があればエラーメッセージ、なければ null
 */
export function validatePartialInput(body: Partial<GrowthInput>): string | null {
  if (
    body.recordedAt !== undefined &&
    Number.isNaN(new Date(body.recordedAt).getTime())
  ) {
    return "recordedAt は有効な日付で指定してください";
  }
  if (
    body.height !== undefined &&
    body.height !== null &&
    !isValidMeasurement(body.height, MAX_HEIGHT_CM)
  ) {
    return `height は 0 より大きく ${MAX_HEIGHT_CM} 以下の数値で指定してください`;
  }
  if (
    body.weight !== undefined &&
    body.weight !== null &&
    !isValidMeasurement(body.weight, MAX_WEIGHT_KG)
  ) {
    return `weight は 0 より大きく ${MAX_WEIGHT_KG} 以下の数値で指定してください`;
  }
  return null;
}

/**
 * 指定した子供の成長記録一覧を取得する。
 * @param childId 子供の id
 * @returns growth レコードの配列（古い順）
 */
export function listGrowths(childId: string) {
  return growthRepository.findGrowthsByChild(childId);
}

/**
 * 成長記録を作成する。
 * @param childId 対象の子供の id
 * @param input 作成する成長記録の入力
 * @returns 作成した growth レコード
 */
export function createGrowth(childId: string, input: GrowthInput) {
  return growthRepository.createGrowth({
    childId,
    height: input.height ?? null,
    weight: input.weight ?? null,
    recordedAt: input.recordedAt,
  });
}

/**
 * 成長記録を全置換（PUT）で更新する。
 * @param growthId 成長記録の id
 * @param childId 対象の子供の id
 * @param input 置き換える入力
 * @returns 更新後の growth レコード
 */
export function replaceGrowth(
  growthId: string,
  childId: string,
  input: GrowthInput
) {
  return growthRepository.updateGrowthForChild(growthId, childId, {
    height: input.height ?? null,
    weight: input.weight ?? null,
    recordedAt: input.recordedAt,
  });
}

/**
 * 成長記録を部分更新（PATCH）する。渡されたフィールドだけ更新する。
 * @param growthId 成長記録の id
 * @param childId 対象の子供の id
 * @param input 更新したいフィールドのみを含む入力
 * @returns 更新後の growth レコード
 */
export function updateGrowth(
  growthId: string,
  childId: string,
  input: Partial<GrowthInput>
) {
  const data: { height?: number | null; weight?: number | null; recordedAt?: string } = {};
  if (input.height !== undefined) data.height = input.height;
  if (input.weight !== undefined) data.weight = input.weight;
  if (input.recordedAt !== undefined) data.recordedAt = input.recordedAt;

  return growthRepository.updateGrowthForChild(growthId, childId, data);
}

/**
 * 成長記録を削除する。
 * @param growthId 成長記録の id
 * @param childId 対象の子供の id
 */
export function deleteGrowth(growthId: string, childId: string) {
  return growthRepository.deleteGrowthForChild(growthId, childId);
}
