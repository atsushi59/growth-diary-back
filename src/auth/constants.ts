// 認証モード。AUTH_MODE がこの値のときだけローカルの固定ユーザーを使う。
// 未設定・他の値はすべて本番扱い（実 Cognito 検証）= デフォルトを安全側にする。
export const AUTH_MODE_DUMMY = "dummy";

// 認証をスキップする運用系エンドポイント（ヘルスチェック）。これ以外は全てログイン必須。
export const PUBLIC_PATHS = ["/", "/health"];
