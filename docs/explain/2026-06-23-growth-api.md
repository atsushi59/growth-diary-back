# 変更解説: 成長記録API ＋ 発育曲線マスタ

## 全体像

子供の成長記録（身長・体重）を読み書きする CRUD API と、母子手帳のような発育曲線グラフの背景に使う「発育曲線マスタ（パーセンタイル帯）」とその取得 API を追加した（チケット #18）。#17 の認証基盤の上に乗せ、**他人の子供のデータを触れないよう所有チェックを必須**にしている。

データの流れ:

```
GET/POST /children/:childId/growth          → その子の成長記録（古い順）
PUT/PATCH/DELETE /children/:childId/growth/:id → 1件の更新・削除
GET /children/:childId/growth-standards     → その子の性別に合った帯（身長/体重）

各エンドポイント: 認証(req.user) → :childId が本人の子か確認(404) → 本処理
```

## 変更ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| prisma/schema.prisma | GrowthStandard モデル追加 |
| prisma/migrations/.../migration.sql | growth_standards テーブル作成 |
| prisma/data/growth_standards.json | 発育曲線マスタの seed データ（新規） |
| prisma/seed.ts | マスタ投入処理を追加 |
| src/prismaError.ts | P2025 判定を共通化（新規） |
| src/routes/verifyChildOwnership.ts | :childId 所有チェック共通関数（新規） |
| src/routes/growth.ts | 成長記録 CRUD（新規） |
| src/routes/growthStandards.ts | 発育曲線マスタ取得 API（新規） |
| src/routes/children.ts | P2025 判定を共通モジュールに置換 |
| src/server.ts | 2プラグインを register |

---

## 詳細解説

### 1. prisma/schema.prisma — 発育曲線マスタのテーブル定義

性別 × 月齢 × 項目（身長/体重）ごとに、下限（3パーセンタイル）と上限（97パーセンタイル）を持つマスタ。`Growth`（成長記録）は既存のものをそのまま使うので変更なし。

```prisma
model GrowthStandard {
  id        Int    @id @default(autoincrement())
  gender    String // "male" / "female"
  ageMonths Int    @map("age_months") // 0〜72
  metric    String // "height" / "weight"
  min       Float  // 下限（3パーセンタイル）
  max       Float  // 上限（97パーセンタイル）
  @@unique([gender, ageMonths, metric])
  @@map("growth_standards")
}
```

`@@unique([gender, ageMonths, metric])` … この3つの組み合わせは1件だけ、という制約。seed の upsert（後述）の「キー」にもなり、性別での検索インデックスとしても効く。

### 2. prisma/migrations/20260622225348_growth_standards/migration.sql — テーブル作成

スキーマ変更を DB に反映する SQL。`Float` は PostgreSQL の `DOUBLE PRECISION` になる。

```sql
CREATE TABLE "growth_standards" ( ... "min" DOUBLE PRECISION NOT NULL, ... );
CREATE UNIQUE INDEX "growth_standards_gender_age_months_metric_key"
  ON "growth_standards"("gender", "age_months", "metric");
```

### 3. prisma/data/growth_standards.json — seed データ

こども家庭庁「令和5年乳幼児身体発育調査」が出典の帯データ（身長46件＋体重46件＝92件）。0〜23ヶ月は1ヶ月ごと、24ヶ月以降は6ヶ月ごとの粒度。コードに値を直書きせず JSON に分離している。

### 4. prisma/seed.ts — マスタ投入処理の追加

既存のダミーユーザー投入に加え、JSON を読んでマスタを投入する関数を追加。

```ts
async function seedGrowthStandards() {
  const dataPath = fileURLToPath(new URL("./data/growth_standards.json", import.meta.url));
  const standards = JSON.parse(readFileSync(dataPath, "utf-8"));

  for (const standard of standards) {
    await prisma.growthStandard.upsert({
      where: { gender_ageMonths_metric: { gender, ageMonths, metric } },
      update: { min, max },   // 既にあれば値だけ更新
      create: standard,       // 無ければ作る
    });
  }
}
```

- `new URL(..., import.meta.url)` … ESM で「このファイルからの相対パス」を解決する書き方（`__dirname` の代わり）。
- `upsert` のキー `gender_ageMonths_metric` は、スキーマの `@@unique([gender, ageMonths, metric])` から Prisma が自動生成する複合キー名。再実行しても重複せず・値の修正も反映される（冪等）。

### 5. src/prismaError.ts — P2025 判定の共通化

「対象レコードなし(P2025)」の判定は #17 で children.ts に書いていたが、growth でも同じ判定が要るため**共通モジュールに切り出した**（重複排除）。

```ts
export function isRecordNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}
```

children.ts はローカル定義を消して、ここから import するように変更（後述）。

### 6. src/routes/verifyChildOwnership.ts — 所有チェックの共通関数

このチケットの**セキュリティの肝**。URL の `:childId` が「ログイン中ユーザー本人の子か」を確認し、本人の子だけを返す。growth と growth-standards の両方が冒頭で呼ぶ。

```ts
export async function verifyChildOwnership(request, reply): Promise<Child | null> {
  const childId = Number((request.params as { childId: string }).childId);

  const child = await prisma.child.findFirst({
    where: { id: childId, userId: request.user.id },   // ← 本人の子だけヒット
  });
  if (!child) {
    reply.code(404).send({ error: "Child not found" });  // 他人/不存在は 404
    return null;
  }
  return child;
}
```

- **なぜ 403 ではなく 404 か**: 403（権限なし）だと「その子は存在するが他人のもの」と分かり、ID の存在を推測される。404 なら存在自体を隠せる。
- 呼び出し側は `const child = await verifyChildOwnership(...); if (!child) return reply;` の2行で使う。reply は関数内で送信済みなので、ハンドラは何もせず終了する。
- `req.user` は #17 の認証フックが事前にセット済み（onRequest → preHandler/ハンドラの順なので必ず存在する）。

### 7. src/routes/growth.ts — 成長記録の CRUD

`/children/:childId/growth` 配下の5エンドポイント。各ハンドラは「所有チェック → バリデーション → 本処理」の順。

**入力バリデーション**（作成/全置換と部分更新で分離）:

```ts
function validateFullInput(body): string | null {
  if (!body.recordedAt || Number.isNaN(new Date(body.recordedAt).getTime()))
    return "recordedAt は有効な日付で指定してください";
  const hasHeight = ...; const hasWeight = ...;
  if (!hasHeight && !hasWeight) return "height か weight の少なくとも一方は必須です";
  // 正の数・上限チェック ...
}
```

- height/weight は**どちらも任意だが、少なくとも一方は必須**（両方空の無意味なレコードを作らせない）。
- `recordedAt`（測定日）はクライアントから受け取る。フロントは年月だけ選び `YYYY-MM-01` で送る前提で、バックはそのまま DateTime 保存（スキーマ変更不要）。

**所有チェック ＋ 本処理**（GET 一覧の例）:

```ts
fastify.get("/", async (request, reply) => {
  const child = await verifyChildOwnership(request, reply);
  if (!child) return reply;                       // 他人/不存在は 404 済み
  const growths = await prisma.growth.findMany({
    where: { childId: child.id },
    orderBy: { recordedAt: "asc" },               // 古い順＝成長の推移が見やすい
  });
  return reply.send(growths);
});
```

**更新・削除の二重チェック**（PUT の例）:

```ts
const updated = await prisma.growth.update({
  where: { id: Number(request.params.id), childId: child.id },  // ← childId も条件に
  data: { ... },
});
```

`where` に `childId` も入れることで「その成長記録が本当にこの子のものか」を1クエリで担保。違う子の記録や存在しない id は Prisma が P2025 を投げ、`catch` で 404 に変換する（#17 と同じパターン）。

### 8. src/routes/growthStandards.ts — 発育曲線マスタ取得

`GET /children/:childId/growth-standards`。その子の**性別をサーバー側で見て自動フィルタ**し、身長・体重両方の帯を返す（フロントは gender を意識しなくてよい）。

```ts
const standards = await prisma.growthStandard.findMany({
  where: { gender: child.gender },        // 子の性別で絞る
  orderBy: { ageMonths: "asc" },
});
return reply.send({
  source: GROWTH_STANDARD_SOURCE,         // 出典をアプリ内に明記
  gender: child.gender,
  height: standards.filter(s => s.metric === "height").map(toBand),
  weight: standards.filter(s => s.metric === "weight").map(toBand),
});
```

`toBand` で `{ ageMonths, min, max }` だけに絞ってグラフ用に整形。`source` で出典表記（こども家庭庁の調査）を必ず返す。

### 9. src/routes/children.ts — P2025 判定の置き換え

ローカルに持っていた `isRecordNotFoundError` を削除し、`../prismaError.js` から import するだけに変更（機能は同じ、重複排除のためのリファクタ）。

### 10. src/server.ts — ルートの登録

成長記録系を child 配下にネストして register。Fastify は **prefix にパラメータ（`:childId`）を含められる**ので、各ハンドラで `request.params.childId` が取れる。

```ts
fastify.register(growthRoutes, { prefix: "/children/:childId/growth" });
fastify.register(growthStandardsRoutes, { prefix: "/children/:childId/growth-standards" });
```

---

## 補足: 設計上のポイント

- **所有チェックを共通関数に集約**したことで、growth と growth-standards で同じ安全性を担保しつつ重複を避けている。
- **404 で存在を隠す**方針は #17 の children と一貫。
- マスタは**コードに直書きせず JSON ＋ upsert seed**にしたので、値の修正は JSON を直して seed を流すだけで済む。
