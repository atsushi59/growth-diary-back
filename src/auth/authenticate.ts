import type { FastifyRequest } from "fastify";
import type { User } from "../../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { AUTH_MODE_DUMMY } from "./constants.js";
import { DUMMY_USER } from "./dummyUser.js";
import { verifyAccessToken } from "./cognitoVerifier.js";

/** 認証失敗（トークン無し / 期限切れ / 不正）を表す。呼び出し側で 401 に変換する。 */
export class AuthError extends Error {}

/**
 * リクエストを認証し、対応する users レコードを返す。
 * dummy / 本番の分岐はこの関数1か所に閉じ込める。最終的にどちらも users レコードを返す状態に揃える。
 * @param request 受信した Fastify リクエスト
 * @returns 認証済みユーザー（users レコード）
 */
export async function authenticate(request: FastifyRequest): Promise<User> {
  // ローカルのダミー認証: 固定テストユーザーを返す。
  if (process.env.AUTH_MODE === AUTH_MODE_DUMMY) {
    return findOrCreateUser(
      DUMMY_USER.cognitoSub,
      DUMMY_USER.name,
      DUMMY_USER.email
    );
  }

  // 本番: Authorization ヘッダの Cognito アクセストークンを検証する。
  const token = extractBearerToken(request.headers.authorization);
  if (!token) throw new AuthError("認証トークンがありません");

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    throw new AuthError("トークンの検証に失敗しました");
  }

  // アクセストークンは profile（email / name）を含まないため、得られる情報でフォールバックする。
  // 正式なプロフィール同期は別途検討（本番接続確認時に見直す）。
  const sub = payload.sub;
  const name = typeof payload.username === "string" ? payload.username : sub;
  const email = `${sub}@cognito.local`;
  return findOrCreateUser(sub, name, email);
}

/**
 * cognito_sub で users を JIT（初回アクセス時に自動作成）で解決して返す。
 * upsert にすることで、初回アクセスが同時に複数届いても unique 制約違反にならない。
 * 既存ユーザーは update:{} で何も変更しない（後からプロフィール同期で更新される値を保持する）。
 * @param cognitoSub Cognito のユーザー固有ID（sub）
 * @param name 新規作成時に使う表示名
 * @param email 新規作成時に使うメールアドレス
 * @returns 既存または新規作成した users レコード
 */
async function findOrCreateUser(
  cognitoSub: string,
  name: string,
  email: string
): Promise<User> {
  return prisma.user.upsert({
    where: { cognitoSub },
    update: {},
    create: { cognitoSub, name, email },
  });
}

/**
 * Authorization ヘッダから Bearer トークンを取り出す。
 * @param authorization Authorization ヘッダの値
 * @returns トークン文字列。形式が不正なら null
 */
function extractBearerToken(authorization: string | undefined): string | null {
  if (!authorization) return null;

  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) return null;

  return token;
}
