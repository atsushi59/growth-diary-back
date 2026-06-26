import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { IMAGES_BUCKET } from "../config/s3.js";
import { s3 } from "../plugins/s3.js";

// 許可する画像の Content-Type と拡張子の対応（単一情報源）。
// 用途を問わず共通で使う。新しい形式を許可するならここに1行足す。
const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type AllowedImageType = keyof typeof ALLOWED_IMAGE_TYPES;

// 署名付きアップロード URL の有効期限（秒）。短くして悪用の窓を狭める。
const UPLOAD_URL_EXPIRES_IN = 300;

export type ImageUploadUrl = {
  uploadUrl: string;
  key: string;
  expiresIn: number;
};

/**
 * Content-Type が許可された画像形式かを判定する（型ガード）。
 * @param contentType クライアントが指定した Content-Type
 * @returns 許可形式なら true
 */
export function isAllowedImageType(
  contentType: string
): contentType is AllowedImageType {
  // in 演算子だとプロトタイプ（constructor 等）も拾ってしまうため hasOwn で自前のキーだけ見る
  return Object.hasOwn(ALLOWED_IMAGE_TYPES, contentType);
}

/**
 * 画像アップロード用の署名付き PUT URL を発行する（用途共通）。
 * 呼び出し側で所有チェックと Content-Type 検証を済ませてから呼ぶこと。
 * @param keyPrefix オブジェクトキーの接頭辞（例: children/<childId>）
 * @param contentType 許可済みの画像 Content-Type
 * @returns アップロード URL・採番したオブジェクトキー・有効期限
 */
export async function createImageUploadUrl(
  keyPrefix: string,
  contentType: AllowedImageType
): Promise<ImageUploadUrl> {
  const extension = ALLOWED_IMAGE_TYPES[contentType];
  const key = `${keyPrefix}/${randomUUID()}.${extension}`;

  // ContentType を署名に焼き込み、クライアントは同じ Content-Type でしか PUT できないようにする。
  const command = new PutObjectCommand({
    Bucket: IMAGES_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: UPLOAD_URL_EXPIRES_IN,
  });

  return { uploadUrl, key, expiresIn: UPLOAD_URL_EXPIRES_IN };
}
