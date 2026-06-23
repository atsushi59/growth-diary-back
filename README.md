# growth-diary-back

子供の成長日記アプリのバックエンド（Fastify + Prisma + PostgreSQL）。

## 技術スタック

- Node.js 22（Lambda の `nodejs22.x` とメジャーバージョンを統一）
- Fastify 5
- Prisma 7（`prisma-client` ジェネレータ / ESM / pg アダプタ）
- PostgreSQL 16（Docker コンテナ）

## DB構成（ER図）

`prisma/schema.prisma` の現状テーブルをもとにした ER 図（GitHub 上では図として表示されます）。`growth_standards` は他テーブルと関連を持たないマスタ。

```mermaid
erDiagram
  users ||--o{ children : "owns"
  users ||--o{ recipe_posts : "posts"
  users ||--o{ recipe_comments : "writes"
  users ||--o{ recipe_likes : "likes"
  children ||--o{ growth : "has"
  children ||--o{ vaccination_records : "has"
  children ||--o{ albums : "has"
  children ||--o{ food_records : "has"
  vaccine_master ||--o{ vaccination_records : "referenced by"
  food_master ||--o{ food_records : "referenced by"
  recipe_posts ||--o{ recipe_comments : "has"
  recipe_posts ||--o{ recipe_likes : "has"

  users {
    int id PK
    string cognito_sub UK
    string name
    string email UK
    datetime created_at
    datetime updated_at
  }
  children {
    int id PK
    int user_id FK
    string name
    date birthday
    string gender
    datetime created_at
    datetime updated_at
  }
  growth {
    int id PK
    int child_id FK
    float height "任意"
    float weight "任意"
    datetime recorded_at
  }
  growth_standards {
    int id PK
    string gender
    int age_months
    string metric
    float min
    float max
  }
  vaccine_master {
    int id PK
    string name
    int dose_number
    int min_start_month
    int standard_month
    string type
    string category
  }
  vaccination_records {
    int id PK
    int child_id FK
    int vaccine_id FK
    date vaccinated_at
  }
  albums {
    int id PK
    int child_id FK
    string image
    string message "任意"
    datetime created_at
  }
  food_master {
    int id PK
    string name
    int start_month
    string stage
    string category
    string note "任意"
  }
  food_records {
    int id PK
    int child_id FK
    int food_id FK
    boolean has_eaten
    date eaten_at "任意"
  }
  recipe_posts {
    int id PK
    int user_id FK
    string title
    string description "任意"
    string image "任意"
    int likes_count
    datetime created_at
    datetime updated_at
  }
  recipe_comments {
    int id PK
    int post_id FK
    int user_id FK
    string comment
    datetime created_at
    datetime updated_at
  }
  recipe_likes {
    int id PK
    int post_id FK
    int user_id FK
    datetime created_at
  }
```

> `recipe_likes` は `(post_id, user_id)` の複合ユニーク制約あり（同じ投稿への重複いいねを防止）。各 FK は子側を `onDelete: Cascade`。

## 起動手順（Docker）

```bash
# 1. コンテナをビルドして起動（app + db の2コンテナ）
docker compose up --build

# 2. 別ターミナルで、DBにテーブルを作成（初回のみ）
docker compose exec app npx prisma migrate dev --name init

# 3. 動作確認
curl http://localhost:3000/health
# -> {"status":"ok"}
```

停止は `docker compose down`、DBのデータも消すなら `docker compose down -v`。

## Git / GitHub 連携手順（HTTPS）

`.gitignore` を用意した後にリポジトリを作る（`node_modules/` や `.env` の誤pushを防ぐ）。

```bash
git init
git add .
git commit -m "初期構成: Fastify+Prisma+PostgreSQL"
# GitHub に空リポジトリ growth-diary-back を作成してから:
git remote add origin <HTTPSのURL>
git push -u origin main
```

### コミットの区切り方（推奨）

1. `.gitignore追加`
2. `schema.prisma に#43設計の全テーブル定義`
3. `Dockerfile追加`
4. `compose.ymlでNode+PostgreSQL定義`
5. `compose up動作確認完了`

## 注意

- `.env` は DB接続情報を含むため push しない（`.env.example` のみ共有）。
- アプリは `0.0.0.0` で待ち受ける（コンテナ外からアクセスするため）。
