# 変更解説: Cognito ユーザープールを SAM テンプレートに定義

## 全体像

フロント (#22) を本物の Cognito 認証に接続するため、認証基盤である **Cognito ユーザープール**と **SPA 用アプリクライアント**を `template.yaml`（AWS SAM テンプレート）に定義した変更。バックエンドは既に `aws-jwt-verify` でトークンを検証する作りになっているため、このコミットでは「検証する相手（Cognito）」を AWS 上に作るための定義を追加し、生成された ID をバックエンドの環境変数へ連携する。

変更ファイルは `template.yaml` の 1 件のみ（42 行追加）。

## 変更ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| template.yaml | Cognito ユーザープール / アプリクライアントのリソース定義、Lambda 環境変数への ID 連携、Outputs への ID 出力 |

## 前提知識（初出の用語）

- **SAM テンプレート** — AWS のインフラ（Lambda・DynamoDB・Cognito など）をコードで宣言するファイル。`sam deploy` で実際の AWS リソースに反映される（IaC = Infrastructure as Code）。
- **Cognito ユーザープール** — AWS のユーザー認証サービス。サインアップ／サインインやパスワード管理、JWT トークン発行を担う「ユーザーの入れ物」。
- **アプリクライアント** — ユーザープールにアクセスするアプリ側の登録情報。フロントはこの Client ID を使って Cognito と通信する。
- **`Ref` / `!Ref`** — CloudFormation の組み込み関数。別リソースの値（ここではデプロイ時に決まる ID）を参照する。`Ref:`（長形式）と `!Ref`（短縮形タグ）は同じ意味。

## 詳細解説

### template.yaml

#### 1. Cognito ユーザープールの定義（`CognitoUserPool`）

```yaml
CognitoUserPool:
  Type: AWS::Cognito::UserPool
  Properties:
    UserPoolName: growth-diary-user-pool
    UsernameAttributes:
      - email
    AutoVerifiedAttributes:
      - email
    Policies:
      PasswordPolicy:
        MinimumLength: 8
        RequireUppercase: true
        RequireLowercase: true
        RequireNumbers: true
        RequireSymbols: false
```

ユーザーの認証基盤そのものを作る定義。各プロパティの意味は以下のとおり。

- `UsernameAttributes: email` — ユーザー名としてメールアドレスを使う（メールでサインイン）。
- `AutoVerifiedAttributes: email` — サインアップ時に Cognito が確認コードをメール送信し、メール検証を行う。
- `PasswordPolicy` — パスワード要件。8 文字以上＋大文字・小文字・数字を必須、記号は任意。チケットの「サインアップポリシー設定」に対応する部分。

#### 2. アプリクライアントの定義（`CognitoUserPoolClient`）

```yaml
CognitoUserPoolClient:
  Type: AWS::Cognito::UserPoolClient
  Properties:
    ClientName: growth-diary-app-client
    UserPoolId: !Ref CognitoUserPool
    GenerateSecret: false # フロントエンド（SPA）から直接通信するため false が必須
    ExplicitAuthFlows:
      - ALLOW_USER_SRP_AUTH
      - ALLOW_REFRESH_TOKEN_AUTH
      - ALLOW_USER_PASSWORD_AUTH
```

フロント（SPA）が Cognito と通信するための窓口。

- `UserPoolId: !Ref CognitoUserPool` — 上で定義したユーザープールに紐づける。`!Ref` でデプロイ時に確定するプール ID を参照する。
- `GenerateSecret: false` — クライアントシークレットを発行しない。ブラウザで動く SPA はシークレットを安全に保持できないため、SPA では `false` が必須。
- `ExplicitAuthFlows` — 許可する認証フロー。`USER_SRP_AUTH`（パスワードを送らず安全に認証する SRP 方式）を主軸に、リフレッシュトークン更新とパスワード直接認証を許可。

#### 3. Lambda 環境変数への ID 連携（`Environment.Variables` への追加）

```yaml
COGNITO_USER_POOL_ID:
  Ref: CognitoUserPool
COGNITO_CLIENT_ID:
  Ref: CognitoUserPoolClient
```

`FastifyApiFunction`（バックの Lambda）の環境変数に、作成したプール／クライアントの ID を `Ref` で注入する。バックの [src/middleware/cognitoVerifier.ts](../../src/middleware/cognitoVerifier.ts) がこの 2 つの環境変数を読み、`CognitoJwtVerifier.create({ userPoolId, clientId })` でトークン検証器を組み立てる。**ID をハードコードせず参照で渡す**ため、再デプロイで ID が変わっても自動で追従する。

#### 4. Outputs への ID 出力

```yaml
UserPoolId:
  Description: "Cognito User Pool ID"
  Value:
    Ref: CognitoUserPool
UserPoolClientId:
  Description: "Cognito User Pool Client ID"
  Value:
    Ref: CognitoUserPoolClient
```

`Outputs` はデプロイ後にターミナルへ表示される値。フロント (#22) で必要になる User Pool ID / Client ID を、デプロイのたびに `sam deploy` の出力から取得できるようにする。

## 補足: デプロイで実際に得られた ID

`sam deploy` 実行済み（スタック `growth-diary-back` / `ap-northeast-1`）。

- User Pool ID: `ap-northeast-1_GdsE1Ir4y`
- App Client ID: `7b8tugcp6pnfq7erk0afsdi6l2`
