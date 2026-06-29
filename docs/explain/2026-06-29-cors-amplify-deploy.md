# 変更解説: CORS 複数オリジン対応と本番デプロイ設定（Amplify / 実Cognito）

## 全体像

本番フロント（AWS Amplify Hosting）から API を利用できるようにするための変更。CORS の許可オリジンを単一固定から環境変数（カンマ区切り）で複数指定できるようにし、本番デプロイ時に Amplify ドメインの許可と実 Cognito 認証への切替を行う。

## 変更ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `src/app.ts` | CORS 許可オリジンを `FRONTEND_ORIGINS`（カンマ区切り）対応に |
| `.env.example` | `FRONTEND_ORIGINS` を追記 |
| `template.yaml` | `FrontendOrigins` パラメータ追加・Lambda 環境変数へ受け渡し |
| `test/integration/cors.test.ts` | 追加オリジン許可のテストを追加 |
| `samconfig.toml` | 本番パラメータを実Cognito・Amplifyオリジンに設定 |

## 詳細解説

### 1. src/app.ts — CORS 許可オリジンの複数化

```ts
const DEFAULT_FRONTEND_ORIGIN = "http://localhost:5173";

function getAllowedOrigins(): string[] {
  return (process.env.FRONTEND_ORIGINS ?? DEFAULT_FRONTEND_ORIGIN)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
// ...
fastify.register(cors, { origin: getAllowedOrigins(), methods: [...] });
```

**before**: `LOCAL_FRONTEND_ORIGIN = "http://localhost:5173"` を単一でハードコードしていた。
**after**: `FRONTEND_ORIGINS` をカンマ区切りで読み、`@fastify/cors` の `origin` に**配列**で渡す。`@fastify/cors` は配列を渡すと「リクエストの `Origin` が配列に含まれていれば許可」する。未設定時はローカル開発用にフォールバックするので、ローカルは今まで通り動く。

### 2. .env.example — 設定例の追記

`FRONTEND_ORIGINS=http://localhost:5173` を追記。本番は `http://localhost:5173,https://main.xxxx.amplifyapp.com` のように Amplify ドメインを足す、と例示。

### 3. template.yaml — SAM パラメータ化

```yaml
Parameters:
  FrontendOrigins:
    Type: String
    Default: http://localhost:5173
# Lambda の Environment.Variables
  FRONTEND_ORIGINS:
    Ref: FrontendOrigins
```

CORS 許可オリジンをコードに焼き込まず、**デプロイ時パラメータ**で渡せるようにする。`AllowedOrigin`（S3 バケットの CORS）・`AuthMode` は既存パラメータで、これらを `samconfig.toml` で本番値に上書きする。

### 4. test/integration/cors.test.ts — 追加オリジンの検証

`FRONTEND_ORIGINS` に複数オリジンを設定 → そのオリジンからの OPTIONS プリフライトで `access-control-allow-origin` が一致して返ることを確認するテストを追加。`buildApp` は `getAllowedOrigins()` を起動時に評価するため、env をセットしてから `buildApp` する点に注意。

### 5. samconfig.toml — 本番デプロイの値

```toml
parameter_overrides = [
  "AuthMode=cognito",
  "FrontendOrigins=http://localhost:5173,https://main.dpjgua90aliia.amplifyapp.com",
  "AllowedOrigin=https://main.dpjgua90aliia.amplifyapp.com",
]
```

**before**: `"AuthMode=dummy"` のみ（本番もダミー認証・CORS は localhost のみ）。
**after**: 実 Cognito 認証（`AuthMode=cognito`）、API CORS に Amplify オリジンを追加、S3 直アップロード用の CORS（`AllowedOrigin`）も Amplify オリジンに設定。`sam deploy` はこの `samconfig.toml` を参照するため、デプロイ時にこれらが反映される。

## 補足

- 認証方針: **ローカル=ダミーのみ / 本番=実Cognitoのみ**。本番でダミーを禁止するガード（`auth.ts` の `NODE_ENV=production && AUTH_MODE=dummy` で起動失敗）と併用する。
- Cognito のプール/クライアントはスタックが自前で作成し、その ID を Lambda 環境変数へ渡している。フロントの `VITE_COGNITO_*` はこのスタック Outputs の値（`ap-northeast-1_GdsE1Ir4y` / `7b8tugcp6pnfq7erk0afsdi6l2`）と一致している必要がある。
- フロントが送るのは access トークン、バックは `tokenUse: "access"` で検証するため整合している。
