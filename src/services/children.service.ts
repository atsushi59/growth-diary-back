import * as childrenRepository from "../repositories/children.repository.js";

// 登録・更新時にクライアントから受け取る入力の型（userId は認証情報から取るので含めない）。
export type ChildInput = {
  name: string;
  birthday: string; // JSON で届くので文字列。service で Date に変換する。
  gender: string;
};

/**
 * 本人の子供を全件取得する。
 * @param userId 認証ユーザーの id
 * @returns children レコードの配列
 */
export function listChildren(userId: number) {
  return childrenRepository.findChildrenByUser(userId);
}

/**
 * 本人の子供を1件取得する。
 * @param childId 子供の id
 * @param userId 認証ユーザーの id
 * @returns children レコード。無ければ null
 */
export function getChild(childId: number, userId: number) {
  return childrenRepository.findChildByIdForUser(childId, userId);
}

/**
 * 子供を作成する。
 * @param userId 所有ユーザーの id
 * @param input 作成する子供の入力
 * @returns 作成した children レコード
 */
export function createChild(userId: number, input: ChildInput) {
  return childrenRepository.createChild({
    userId,
    name: input.name,
    birthday: new Date(input.birthday),
    gender: input.gender,
  });
}

/**
 * 子供を全置換（PUT）で更新する。
 * @param childId 子供の id
 * @param userId 所有ユーザーの id
 * @param input 置き換える入力
 * @returns 更新後の children レコード
 */
export function replaceChild(childId: number, userId: number, input: ChildInput) {
  return childrenRepository.updateChildForUser(childId, userId, {
    name: input.name,
    birthday: new Date(input.birthday),
    gender: input.gender,
  });
}

/**
 * 子供を部分更新（PATCH）する。渡されたフィールドだけ更新する。
 * @param childId 子供の id
 * @param userId 所有ユーザーの id
 * @param input 更新したいフィールドのみを含む入力
 * @returns 更新後の children レコード
 */
export function updateChild(
  childId: number,
  userId: number,
  input: Partial<ChildInput>
) {
  const data: { name?: string; birthday?: Date; gender?: string } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.birthday !== undefined) data.birthday = new Date(input.birthday);
  if (input.gender !== undefined) data.gender = input.gender;

  return childrenRepository.updateChildForUser(childId, userId, data);
}

/**
 * 子供を削除する。
 * @param childId 子供の id
 * @param userId 所有ユーザーの id
 */
export function deleteChild(childId: number, userId: number) {
  return childrenRepository.deleteChildForUser(childId, userId);
}
