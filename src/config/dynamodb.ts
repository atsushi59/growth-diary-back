// DynamoDB のテーブル名。Lambda では template.yaml が env で実テーブル名を渡す。
// ローカル/テストでは未設定なら下のデフォルト名を使う。
export const TABLES = {
  users: process.env.USERS_TABLE ?? "Users",
  children: process.env.CHILDREN_TABLE ?? "Children",
  growth: process.env.GROWTH_TABLE ?? "Growth",
  growthStandards: process.env.GROWTH_STANDARDS_TABLE ?? "GrowthStandards",
} as const;
