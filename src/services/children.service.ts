import * as childrenRepository from "../repositories/children.repository.js";
import * as growthRepository from "../repositories/growth.repository.js";
import type { Child } from "../types/models.js";
import * as uploadService from "./upload.service.js";

/**
 * S3 画像をベストエフォートで削除する（DB は正、S3 は後追い。失敗してもリクエストは止めない）。
 * @param key 削除する S3 オブジェクトキー（未設定なら何もしない）
 */
async function deleteImageIfPresent(key: string | undefined): Promise<void> {
  if (!key) return;
  try {
    await uploadService.deleteImage(key);
  } catch (error) {
    console.error(`S3 画像の削除に失敗しました: ${key}`, error);
  }
}

// 登録・更新時にクライアントから受け取る入力の型（userId は認証情報から取るので含めない）。
export type ChildInput = {
  name: string;
  birthday: string; // 文字列のまま保存する（DynamoDB は日付型を持たない）
  gender: string;
  image?: string; // S3 オブジェクトキー（任意）。#70 でアップロードした画像を紐づける。
};

// API レスポンスの子供。保存している image(キー)に加え、表示用の署名付き URL を都度付与する。
// 画像が無い・発行に失敗した場合は imageUrl を null にする。
export type ChildResponse = Child & { imageUrl: string | null };

/**
 * 子供に表示用の署名付き画像 URL を付与する（image が無ければ imageUrl は null）。
 * バケットは非公開なので、表示にはその都度発行する署名付き GET URL が要る。
 * @param child 付与対象の子供
 * @returns imageUrl を付けた子供
 */
async function attachImageUrl(child: Child): Promise<ChildResponse> {
  if (!child.image) return { ...child, imageUrl: null };
  // best-effort: 署名 URL の発行が失敗しても、その子（や一覧全体）を落とさず imageUrl=null で返す
  try {
    const imageUrl = await uploadService.createImageViewUrl(child.image);
    return { ...child, imageUrl };
  } catch (error) {
    console.error(`表示用URLの発行に失敗しました: ${child.image}`, error);
    return { ...child, imageUrl: null };
  }
}

/**
 * 子供の配列それぞれに表示用の署名付き画像 URL を付与する。
 * @param children 付与対象の子供配列
 * @returns imageUrl を付けた子供配列
 */
function attachImageUrls(children: Child[]): Promise<ChildResponse[]> {
  return Promise.all(children.map(attachImageUrl));
}

/**
 * 本人の子供を全件取得する。
 * @param userId 認証ユーザーの cognitoSub
 * @returns 子供の配列
 */
export async function listChildren(userId: string) {
  const children = await childrenRepository.findChildrenByUser(userId);
  return attachImageUrls(children);
}

/**
 * 本人の子供を1件取得する。
 * @param childId 子供の id
 * @param userId 認証ユーザーの cognitoSub
 * @returns 子供。無ければ null
 */
export async function getChild(childId: string, userId: string) {
  const child = await childrenRepository.findChildByIdForUser(childId, userId);
  return child ? attachImageUrl(child) : null;
}

/**
 * 子供を作成する。
 * @param userId 所有ユーザーの cognitoSub
 * @param input 作成する子供の入力
 * @returns 作成した子供
 */
export async function createChild(userId: string, input: ChildInput) {
  const child = await childrenRepository.createChild({
    userId,
    name: input.name,
    birthday: input.birthday,
    gender: input.gender,
    image: input.image,
  });
  return attachImageUrl(child);
}

/**
 * 子供を全置換（PUT）で更新する。対象が無ければ null。
 * @param childId 子供の id
 * @param userId 所有ユーザーの cognitoSub
 * @param input 置き換える入力
 * @returns 更新後の子供。無ければ null
 */
export async function replaceChild(
  childId: string,
  userId: string,
  input: ChildInput
) {
  const result = await childrenRepository.updateChildForUser(childId, userId, {
    name: input.name,
    birthday: input.birthday,
    gender: input.gender,
    image: input.image,
  });
  if (!result) return null;

  const { child, previousImage } = result;
  // 画像が差し替わったら旧画像を S3 から削除する
  if (previousImage && previousImage !== child.image) {
    await deleteImageIfPresent(previousImage);
  }
  return attachImageUrl(child);
}

/**
 * 子供を部分更新（PATCH）する。渡されたフィールドだけ更新する。対象が無ければ null。
 * @param childId 子供の id
 * @param userId 所有ユーザーの cognitoSub
 * @param input 更新したいフィールドのみを含む入力
 * @returns 更新後の子供。無ければ null
 */
export async function updateChild(
  childId: string,
  userId: string,
  input: Partial<ChildInput>
) {
  const data: {
    name?: string;
    birthday?: string;
    gender?: string;
    image?: string;
  } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.birthday !== undefined) data.birthday = input.birthday;
  if (input.gender !== undefined) data.gender = input.gender;
  if (input.image !== undefined) data.image = input.image;

  const result = await childrenRepository.updateChildForUser(
    childId,
    userId,
    data
  );
  if (!result) return null;

  const { child, previousImage } = result;
  // 画像が差し替わったら旧画像を S3 から削除する
  if (previousImage && previousImage !== child.image) {
    await deleteImageIfPresent(previousImage);
  }
  return attachImageUrl(child);
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
  if (!deleted) return false;

  await growthRepository.deleteAllGrowthsByChild(childId);
  // 子供に紐づく画像も S3 から削除する
  await deleteImageIfPresent(deleted.image);
  return true;
}
