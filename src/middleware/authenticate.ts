import type { FastifyRequest } from "fastify";
import type { User } from "../../generated/prisma/client.js";
import { AUTH_MODE_DUMMY } from "../config/auth.js";
import { DUMMY_USER } from "../config/dummyUser.js";
import { upsertUserByCognitoSub } from "../repositories/users.repository.js";
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
    return upsertUserByCognitoSub(DUMMY_USER);
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
  return upsertUserByCognitoSub({ cognitoSub: sub, name, email });
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
