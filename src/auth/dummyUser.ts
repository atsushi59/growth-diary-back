// ローカルのダミー認証で使う固定テストユーザー。
// seed（DB投入）と認証ミドルウェア（req.user 解決）の両方がここを参照する（Single Source of Truth）。
export const DUMMY_USER = {
  cognitoSub: "local-test",
  name: "ローカルテストユーザー",
  email: "local-test@example.com",
} as const;
