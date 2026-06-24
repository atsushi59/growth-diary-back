// DynamoDB に保存するドメインモデルの型。
// Prisma の自動生成型の代わりに、アプリで扱う形をここで定義する。

// ユーザー（PK=cognitoSub）。Cognito の sub が一意な識別子。
export type User = {
  cognitoSub: string;
  name: string;
  email: string;
  createdAt: string;
};

// 子供（PK=userId, SK=id）。userId は所有ユーザーの cognitoSub。
export type Child = {
  id: string;
  userId: string;
  name: string;
  birthday: string;
  gender: string;
  createdAt: string;
  updatedAt: string;
};

// 成長記録（PK=childId, SK=id）。height / weight はどちらか必須・もう一方は null 可。
export type Growth = {
  id: string;
  childId: string;
  height: number | null;
  weight: number | null;
  recordedAt: string;
};

// 発育曲線マスタ（PK=gender, SK=metric#ageMonths）。
export type GrowthStandard = {
  gender: string;
  ageMonths: number;
  metric: string;
  min: number;
  max: number;
};
