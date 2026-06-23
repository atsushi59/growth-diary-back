# 解説: growth で見る3層のファイル分け

## 全体像

リファクタ前は `routes/growth.ts` 1ファイルに「URL定義・バリデーション・Prisma呼び出し」が全部入っていた。これを **route（HTTP）→ service（ロジック）→ repository（DB）** の3層に分け、各ファイルの役割を1つに絞った。目的は「HTTP の知識・ビジネスロジック・DBアクセスを混ぜない」こと。

## growth に関わるファイル

| ファイル | 役割（1つだけ持つ） |
|----------|----------|
| `routes/growth.route.ts` | URL とハンドラの紐付け＋req/resの受け渡し |
| `services/growth.service.ts` | バリデーション・入力変換などビジネスロジック |
| `repositories/growth.repository.ts` | Prisma を叩く（DBアクセス） |
| `config/growth.ts` | 定数（上限値・出典） |
| `middleware/verifyChildOwnership.ts` | 所有チェック（認可） |
| `utils/prismaError.ts` | P2025判定（汎用ヘルパー） |

---

## 1リクエストを層で追う（POST /children/:childId/growth）

「成長記録を1件登録する」リクエストが、どの層を通るかを順に見る。

### ① route（routes/growth.route.ts）— 入口。HTTP だけ担当

```ts
fastify.post<{ Body: GrowthInput }>("/", async (request, reply) => {
  const child = await verifyChildOwnership(request, reply);   // 認可（middleware）
  if (!child) return reply;                                    // 他人/不存在は404済み

  const error = growthService.validateFullInput(request.body); // 検証（service）
  if (error) return reply.code(400).send({ error });

  const growth = await growthService.createGrowth(child.id, request.body); // 本処理（service）
  return reply.code(201).send(growth);                         // HTTP応答
});
```

route がやるのは **「HTTP の入出力」と「層の呼び出し順の指揮」だけ**。`request.body` を取り出し、結果を `reply` で返す。**Prisma も Date 変換も出てこない**のがポイント。

### ② service（services/growth.service.ts）— ロジックを担当

route から呼ばれる `createGrowth`:

```ts
export function createGrowth(childId: number, input: GrowthInput) {
  return growthRepository.createGrowth({
    childId,
    height: input.height ?? null,
    weight: input.weight ?? null,
    recordedAt: new Date(input.recordedAt),  // ← 文字列→Date 変換はここ（ロジック）
  });
}
```

「`recordedAt` の文字列を Date に変換する」「`height/weight` が無ければ null にする」といった**ビジネスルール**は service が持つ。バリデーション（`validateFullInput`）も service にあり、`height か weight の少なくとも一方は必須` などのルールがここに集約される。**service は HTTP（req/res）も Prisma も知らない** — ただの関数なので単体テストしやすい。

### ③ repository（repositories/growth.repository.ts）— DBだけ担当

service から呼ばれる `createGrowth`:

```ts
export function createGrowth(input: {
  childId: number;
  height: number | null;
  weight: number | null;
  recordedAt: Date;
}) {
  return prisma.growth.create({ data: input });
}
```

**Prisma を呼ぶのはこの層だけ**。「DBにどう保存するか」だけを知っている。もし将来 DB を別物に替えても、影響はこの層に閉じる。

### 流れのまとめ

```
HTTPリクエスト
  → route        : body取り出し・順番の指揮・HTTP応答
  → service      : 検証・Date変換などのロジック
  → repository   : prisma.growth.create
  → DB
```

---

## 横から支える3ファイル

### config/growth.ts — 定数

`MAX_HEIGHT_CM = 300` や出典文字列など、**マジックナンバー/文字列を1か所**に。service がこれを import して検証に使う。値を変えたいときはここだけ直す。

### middleware/verifyChildOwnership.ts — 認可

route の冒頭で「`:childId` が本人の子か」を確認する。これは**全 growth エンドポイント共通**なので関数化してある。中では children の repository を呼ぶ（＝認可も DB アクセスは repository 経由で統一）。

```ts
const child = await findChildByIdForUser(childId, request.user.id); // repository
if (!child) { reply.code(404).send(...); return null; }             // 存在を隠す404
```

### utils/prismaError.ts — 汎用ヘルパー

更新・削除で「対象が無い(P2025)」を 404 に振り分けるための判定。フレームワーク非依存の小さな関数なので utils に置く。route の catch で使う。

```ts
} catch (caughtError) {
  if (isRecordNotFoundError(caughtError)) {
    return reply.code(404).send({ error: "Growth not found" });
  }
  throw caughtError;  // 想定外のエラーは握り潰さず500のまま
}
```

---

## before → after（同じ処理がどう分かれたか）

| 処理 | リファクタ前（1ファイル） | リファクタ後 |
|---|---|---|
| URL定義・req/res | routes/growth.ts | routes/growth.route.ts |
| `validateFullInput` 等 | routes/growth.ts 内の関数 | services/growth.service.ts |
| `new Date(...)` 変換 | route ハンドラ内 | services/growth.service.ts |
| `prisma.growth.create` | route ハンドラ内 | repositories/growth.repository.ts |
| `MAX_HEIGHT_CM` 等 | routes/growth.ts 先頭 | config/growth.ts |

**機能は1ミリも変わっていない**（動作確認済み）。「どこに何を書くか」を整理しただけ。

## なぜ分けるのか（メリット）

- **読む範囲が狭くなる**: 「DBの保存方法を直したい」→ repository だけ見ればよい。
- **テストしやすい**: service は req/res も Prisma も知らない純関数なので、ロジック単体で検証できる。
- **影響範囲が閉じる**: DB差し替え・HTTP仕様変更が、それぞれ1層に収まる。
- **規約として統一**: 「Prisma は repositories だけ」というルールを全機能（children/growth/users）で守れる。

## 注意（やりすぎ注意）

小さなアプリで層を増やしすぎると「ファイルを行き来するだけ」で逆に読みにくくなる。今回 controller を独立させず **route がコントローラを兼ねる3層**にしたのはそのバランス。規模が大きくなったら controller 分離や feature 単位の再編を検討する。
