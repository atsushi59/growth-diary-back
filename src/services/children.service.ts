import * as childrenRepository from "../repositories/children.repository.js";
import * as growthRepository from "../repositories/growth.repository.js";

// 登録・更新時にクライアントから受け取る入力の型（userId は認証情報から取るので含めない）。
export type ChildInput = {
  name: string;
  birthday: string; // 文字列のまま保存する（DynamoDB は日付型を持たない）
  gender: string;
};

/**
 * 本人の子供を全件取得する。
 * @param userId 認証ユーザーの cognitoSub
 * @returns 子供の配列
 */
export function listChildren(userId: string) {
  return childrenRepository.findChildrenByUser(userId);
}

/**
 * 本人の子供を1件取得する。
 * @param childId 子供の id
 * @param userId 認証ユーザーの cognitoSub
 * @returns 子供。無ければ null
 */
export function getChild(childId: string, userId: string) {
  return childrenRepository.findChildByIdForUser(childId, userId);
}

/**
 * 子供を作成する。
 * @param userId 所有ユーザーの cognitoSub
 * @param input 作成する子供の入力
 * @returns 作成した子供
 */
export function createChild(userId: string, input: ChildInput) {
  return childrenRepository.createChild({
    userId,
    name: input.name,
    birthday: input.birthday,
    gender: input.gender,
  });
}

/**
 * 子供を全置換（PUT）で更新する。対象が無ければ null。
 * @param childId 子供の id
 * @param userId 所有ユーザーの cognitoSub
 * @param input 置き換える入力
 * @returns 更新後の子供。無ければ null
 */
export function replaceChild(childId: string, userId: string, input: ChildInput) {
  return childrenRepository.updateChildForUser(childId, userId, {
    name: input.name,
    birthday: input.birthday,
    gender: input.gender,
  });
}

/**
 * 子供を部分更新（PATCH）する。渡されたフィールドだけ更新する。対象が無ければ null。
 * @param childId 子供の id
 * @param userId 所有ユーザーの cognitoSub
 * @param input 更新したいフィールドのみを含む入力
 * @returns 更新後の子供。無ければ null
 */
export function updateChild(
  childId: string,
  userId: string,
  input: Partial<ChildInput>
) {
  const data: { name?: string; birthday?: string; gender?: string } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.birthday !== undefined) data.birthday = input.birthday;
  if (input.gender !== undefined) data.gender = input.gender;

  return childrenRepository.updateChildForUser(childId, userId, data);
}

/**
 * 子供を削除する。削除できたら、その子の成長記録もカスケードで削除する。
 * （DynamoDB には FK のカスケードが無いためアプリ側で行う）
 * @param childId 子供の id
 * @param userId 所有ユーザーの cognitoSub
 * @returns 削除できたら true、無ければ false
 */
export async function deleteChild(childId: string, userId: string) {
  const deleted = await childrenRepository.deleteChildForUser(childId, userId);
  if (deleted) {
    await growthRepository.deleteAllGrowthsByChild(childId);
  }
  return deleted;
}
