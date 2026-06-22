# 変更解説: 認証API（Cognito ＋ ローカルダミー認証）

## 全体像

Amazon Cognito を使った認証を導入した変更。フロントが Cognito で取得した JWT（アクセストークン）を、バック（Fastify）は **検証するだけ** にし、全エンドポイントをログイン必須にした。ローカル開発では実 Cognito を使わず、固定のダミーユーザーで認証をスキップできるようにしている（チケット #17）。

データの流れ:

```
[本番] フロント → Cognito で認証 → JWT 取得 → API に Bearer で送信
        → バックが署名・有効期限を検証 → sub から users を特定（無ければ作成）→ req.user
[ローカル] AUTH_MODE=dummy → トークン検証せず固定ユーザーを req.user にセット
```

## 変更ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| prisma/schema.prisma | User から password 削除・cognitoSub 追加 |
| prisma/migrations/.../migration.sql | 上記スキーマ変更の DB マイグレーション |
| src/auth/dummyUser.ts | ダミーユーザー定義（新規） |
| src/auth/constants.ts | 認証モード・公開パスの定数（新規） |
| src/auth/cognitoVerifier.ts | Cognito トークン検証器（新規） |
| src/auth/authenticate.ts | 認証ロジック本体・dummy/本番の分岐（新規） |
| src/auth/registerAuth.ts | グローバル認証フックの登録（新規） |
| src/types/fastify.d.ts | req.user の型定義（新規） |
| src/server.ts | 認証フックの組み込み |
| src/routes/children.ts | body の userId 廃止・req.user ベースに変更 |
| prisma/seed.ts | ダミーユーザー投入（新規） |
| .env.example / compose.yml / package.json | 環境変数・依存・スクリプト追加 |

---

## 詳細解説

### 1. prisma/schema.prisma — 認証方式に合わせた User の作り替え

パスワードは Cognito が管理するためバックの DB には持たない。代わりに Cognito のユーザー固有 ID（`sub`）と紐づくカラムを足す。

```prisma
model User {
  id         Int      @id @default(autoincrement())
  cognitoSub String   @unique @map("cognito_sub")   // 追加：Cognito の sub と1対1で紐づく
  name       String
  email      String   @unique
  // password を削除（Cognito が管理するため不要）
  ...
}
```

- `@map("cognito_sub")` … TS 側は `cognitoSub`（lowerCamelCase）、DB 側は `cognito_sub`（snake_case）にマッピングする Prisma の記法。
- `@unique` … 1人の Cognito ユーザーに users レコードが1つだけ対応するよう保証する。後述の「sub で検索」が成立する前提になる。

### 2. prisma/migrations/20260622162000_auth_cognito_sub/migration.sql — スキーマ変更を DB に反映

スキーマ（設計図）を変えただけでは DB の実テーブルは変わらない。その差分を SQL にしたもの。

```sql
ALTER TABLE "users" DROP COLUMN "password";
ALTER TABLE "users" ADD COLUMN "cognito_sub" TEXT NOT NULL;
CREATE UNIQUE INDEX "users_cognito_sub_key" ON "users"("cognito_sub");
```

通常は `prisma migrate dev` が対話的に自動生成するが、今回は非対話環境のため手動で SQL を用意し `migrate deploy` で適用した（中身は自動生成と同じ）。

### 3. src/auth/dummyUser.ts — ダミーユーザーの単一定義

ローカルのダミー認証で使う固定ユーザー。**seed（DB投入）と認証ロジックの両方が同じ値を参照する**ように1か所で定義している（定数の一元管理）。

```ts
export const DUMMY_USER = {
  cognitoSub: "local-test",
  name: "ローカルテストユーザー",
  email: "local-test@example.com",
} as const;
```

`as const` … オブジェクトの各値を「ただの string」ではなくリテラル型として固定する TS の記法。意図しない書き換えを防ぐ。

### 4. src/auth/constants.ts — 分岐や除外の判断に使う定数

マジックナンバー/文字列を避け、判断基準を定数化したもの。

```ts
export const AUTH_MODE_DUMMY = "dummy";       // この値のときだけダミー認証
export const PUBLIC_PATHS = ["/", "/health"]; // 認証不要（ヘルスチェック）
```

`AUTH_MODE` が `dummy` 以外（未設定含む）はすべて本番扱いにすることで、**設定し忘れても安全側（実検証）に倒れる** ようにしている。

### 5. src/auth/cognitoVerifier.ts — Cognito トークンの検証器

AWS 公式ライブラリ `aws-jwt-verify` を使って、アクセストークンの **署名・有効期限・対象クライアント** を検証する部品。

```ts
function getVerifier() {
  if (verifier) return verifier;  // 2回目以降は使い回す（公開鍵の再取得を避ける）
  ...
  verifier = CognitoJwtVerifier.create({ userPoolId, tokenUse: "access", clientId });
  return verifier;
}

export async function verifyAccessToken(token: string) {
  return getVerifier().verify(token);
}
```

- **遅延生成（lazy）**: 初回の検証時に1度だけ検証器を作る。Cognito の公開鍵（JWKS）取得を毎回やらないため。
- `tokenUse: "access"` … ID トークンではなくアクセストークンを検証する指定（チケットの方針通り API 認可に使う）。
- 環境変数が無ければ例外を投げる＝設定漏れに早く気づける。

### 6. src/auth/authenticate.ts — 認証の本体（dummy/本番の分岐を集約）

「リクエスト → 対応する users レコード」を返す関数。**dummy と本番の分岐をこの1か所だけに閉じ込める** のが設計の肝。

```ts
export async function authenticate(request): Promise<User> {
  // ① ローカル：トークン検証せず固定ユーザー
  if (process.env.AUTH_MODE === AUTH_MODE_DUMMY) {
    return findOrCreateUser(DUMMY_USER.cognitoSub, DUMMY_USER.name, DUMMY_USER.email);
  }

  // ② 本番：Authorization ヘッダの Bearer トークンを検証
  const token = extractBearerToken(request.headers.authorization);
  if (!token) throw new AuthError("認証トークンがありません");   // ガード節（早期return）

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    throw new AuthError("トークンの検証に失敗しました");
  }
  ...
  return findOrCreateUser(sub, name, email);
}
```

ポイント:

- **`AuthError` クラス**: 認証失敗を表す専用の例外。呼び出し側（フック）はこれを見て 401 に変換する。DB エラーなど他の例外（500 にすべきもの）と区別するために型で分けている。
- **JIT（Just-In-Time）作成**: `findOrCreateUser` が `upsert`（あれば取得・無ければ作成）で users を用意する。事前にユーザー登録 API を作らず、初回アクセス時に自動で用意する方式。

  ```ts
  async function findOrCreateUser(cognitoSub, name, email): Promise<User> {
    return prisma.user.upsert({
      where: { cognitoSub },
      update: {},                          // 既存なら何も変えない（後のプロフィール同期値を保持）
      create: { cognitoSub, name, email }, // 無ければ作る
    });
  }
  ```

  `findUnique → create` の2段だと、新規ユーザーの初回リクエストが同時に来たとき2件目が unique 制約違反になる。`upsert` は1クエリで競合に強い。

- **email のフォールバック（既知の制限）**: アクセストークンには email/name が含まれないため、JIT 作成時は `username` や `sub` を流用し、email は `${sub}@cognito.local` という仮の値を入れている。本番接続確認時に正式なプロフィール同期を見直す前提（コード内コメントにも明記）。
- **`extractBearerToken`**: `Authorization: Bearer xxx` の `xxx` 部分だけ取り出す。形式が不正なら null を返し、呼び出し側で 401 にする。

### 7. src/types/fastify.d.ts — req.user に型をつける

Fastify の `FastifyRequest` に `user` プロパティを生やす型拡張（declaration merging）。これがないと各ルートで `request.user` が型エラーになる。

```ts
declare module "fastify" {
  interface FastifyRequest {
    user: User;   // 認証フックが詰める users レコード
  }
}
```

「既存の型（Fastify のリクエスト）に、自分のプロパティを後付けで合流させる」TS の仕組み。実体は実行時にフックがセットする（型だけの宣言）。

### 8. src/auth/registerAuth.ts — 全ルートに認証を効かせる入口

認証を **個々のルートに書くのではなくグローバルに1回だけ** 仕掛ける。

```ts
export function registerAuth(fastify: FastifyInstance): void {
  // 本番で誤って dummy が入ると全リクエストの認証バイパスになるため起動を止める
  if (process.env.NODE_ENV === "production" && process.env.AUTH_MODE === AUTH_MODE_DUMMY) {
    throw new Error("本番環境（NODE_ENV=production）で AUTH_MODE=dummy は使用できません");
  }

  fastify.decorateRequest("user");   // req.user の置き場所を確保

  fastify.addHook("onRequest", async (request, reply) => {
    const path = request.routeOptions.url ?? request.url;
    if (PUBLIC_PATHS.includes(path)) return;   // ヘルスチェックは素通り

    try {
      request.user = await authenticate(request);   // 認証して user をセット
    } catch (error) {
      if (error instanceof AuthError) {
        return reply.code(401).send({ error: error.message });  // 認証失敗 → 401
      }
      throw error;  // それ以外（DB障害など）は 500 のまま
    }
  });
}
```

- **`onRequest` フック**: Fastify のリクエスト処理の最初に走る関数。ここで認証すれば、以降の全ルートのハンドラに入る前にガードできる。
- **`decorateRequest`**: 全リクエストに `user` というプロパティ枠を用意する Fastify の API。実値はフックで詰める。
- **`routeOptions.url`**: マッチしたルートのパス（例 `/children`）。これが `PUBLIC_PATHS` に含まれるときだけ認証を飛ばす。
- 例外の振り分け（`AuthError` → 401 / それ以外 → そのまま 500）で、認証エラーとシステムエラーを区別している。

### 9. src/server.ts — 認証フックの組み込み

ルート登録より前に `registerAuth` を呼ぶことで、フックが全ルートに適用される。

```ts
registerAuth(fastify);          // ← 追加：先にフックを仕掛ける

fastify.get("/", ...);          // public
fastify.get("/health", ...);    // public
fastify.register(childrenRoutes, { prefix: "/children" });  // 認証必須
```

### 10. src/routes/children.ts — 「誰の」データかを req.user で判断する

認証導入の最大の実コード変更。**クライアントから `userId` を受け取るのをやめ、認証済みの `req.user.id` を使う**。これにより「他人の子供を勝手に登録/閲覧/更新できる」状態を防ぐ。

before / after の要点:

```ts
// before：誰の子供かをリクエストボディ任せにしていた（なりすまし可能）
type CreateChildInput = { userId: number; name: string; ... };
const child = await prisma.child.create({ data: { userId: body.userId, ... } });

// after：userId はサーバが認証情報から決める
type CreateChildInput = { name: string; ... };   // userId を型から削除
const child = await prisma.child.create({ data: { userId: request.user.id, ... } });
```

参照・更新・削除も「本人のものか」を必ず確認する形に統一:

```ts
// before：id だけで取得 → 他人のデータも取れてしまう
const child = await prisma.child.findUnique({ where: { id } });

// after：id ＋ 本人(userId) で絞り込む。無ければ 404
const child = await prisma.child.findFirst({ where: { id, userId: request.user.id } });
```

- 一覧（GET）は `where: { userId: request.user.id }` で本人の子供だけ返す。
- 更新/削除は `where: { id, userId }` を `update`/`delete` に直接渡し、**所有権チェックと操作を1クエリ**で行う。Prisma は対象が無ければ（＝他人の id 含む）例外を投げるので、`catch` して 404 を返す。
  ```ts
  try {
    const updatedChild = await prisma.child.update({
      where: { id: parseInt(id), userId: request.user.id },  // 本人の子供以外はマッチしない
      data: { ... },
    });
    return reply.send(updatedChild);
  } catch {
    return reply.code(404).send({ error: "Child not found" });
  }
  ```

### 11. prisma/seed.ts — ダミーユーザーの投入

ローカルで認証をスキップしても `req.user` に実在の users レコードが要る（children などが `user_id` を必要とするため）。それを1件用意するスクリプト。

```ts
await prisma.user.upsert({
  where: { cognitoSub: DUMMY_USER.cognitoSub },
  update: {},                  // 既にあれば何もしない
  create: { ...DUMMY_USER },   // 無ければ作る
});
```

`upsert` … 「あれば更新・無ければ作成」を1クエリで行う。`update: {}` にすることで、再実行しても重複エラーにならず・既存を壊さない（冪等）。

### 12. 設定ファイル（.env.example / compose.yml / package.json）

- **.env.example / compose.yml**: `AUTH_MODE=dummy` と `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` を追記。ローカルは dummy 固定、本番は Cognito の値を入れる前提。
- **package.json**: `aws-jwt-verify` 依存を追加、`prisma:seed` スクリプトを追加。
- （`.gitignore` に `.claude/` 追加は今回の認証実装とは別の付随変更）

---

## 補足: 動作確認で起きたハマり

実装は正しかったが、確認中に 500/401 が出続けた原因は **ホスト上に残っていた古い `tsx src/server.ts` プロセスがポート3000を握っていた** こと。古いコード（認証フック無し）で応答し、かつホストからは `db` を解決できず `EAI_AGAIN` を出していた。プロセス停止後、コンテナで動かして全ケース期待通りになった。教訓: ホストとコンテナでサーバーを二重起動しない。
