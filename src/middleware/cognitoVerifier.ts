import { CognitoJwtVerifier } from "aws-jwt-verify";

// 検証器は公開鍵（JWKS）を内部キャッシュするため、プロセス内で1つだけ遅延生成して使い回す。
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

/**
 * Cognito アクセストークン検証器を返す（初回呼び出し時に生成）。
 * @returns userPoolId / clientId を設定済みの検証器
 */
function getVerifier() {
  if (verifier) return verifier;

  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  if (!userPoolId || !clientId) {
    throw new Error(
      "COGNITO_USER_POOL_ID と COGNITO_CLIENT_ID を環境変数に設定してください"
    );
  }

  verifier = CognitoJwtVerifier.create({
    userPoolId,
    tokenUse: "access",
    clientId,
  });
  return verifier;
}

/**
 * Cognito アクセストークンを検証し、ペイロード（sub / username 等）を返す。
 * 署名・有効期限・clientId が合わなければ例外を投げる。
 * @param token Authorization ヘッダから取り出した JWT
 * @returns 検証済みトークンのペイロード
 */
export async function verifyAccessToken(token: string) {
  return getVerifier().verify(token);
}
