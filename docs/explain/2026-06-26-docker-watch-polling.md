# 変更解説: tsx watch をポーリング監視にしてマウント越しのホットリロードを有効化

## 全体像

Docker（WSL）開発で、ソースを変更してもコンテナ内の `tsx watch` が拾わず、**古いコードが動き続ける**問題の解消。`compose.yml` の app に `CHOKIDAR_USEPOLLING` を足して、ファイル監視をポーリング方式に切り替える。

## なぜ起きていたか

開発コンテナはホストのソースを `.:/app` でマウントし、`tsx watch` が変更を検知して再起動する想定。だが **Docker Desktop + WSL のマウント境界では inotify（OS のファイル変更通知）がコンテナ内に届かない**ことがあり、`tsx watch` が変更に気づけない。実際、CORS 修正・imageUrl 追加のときに「コードを変えたのに反映されず、手動 `docker compose restart` が必要」という事象が起きていた。

`tsx` 4.22.4 は内部にファイル監視ライブラリ **chokidar** を内蔵しており、環境変数 `CHOKIDAR_USEPOLLING` を読む。これを `true` にすると、OS 通知ではなく**定期的にファイルの更新時刻を見に行くポーリング方式**になり、マウント越しでも変更を検知できる。

## 変更ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| compose.yml | app の環境変数に `CHOKIDAR_USEPOLLING` / `CHOKIDAR_INTERVAL` を追加 |

## 詳細解説

### compose.yml（app の環境変数）

```yaml
CHOKIDAR_USEPOLLING: "true"
CHOKIDAR_INTERVAL: "300"
```

- `CHOKIDAR_USEPOLLING: "true"` … 監視をポーリング方式に切り替える。これが本丸。
- `CHOKIDAR_INTERVAL: "300"` … ポーリング間隔（ミリ秒）。短いほど反映が速いが CPU を食う。300ms は「ほぼ即時に感じる」かつ「常時ポーリングの負荷を抑える」バランス。

## 反映に必要な操作

環境変数の追加なので、**一度だけコンテナの再作成**が要る（`restart` では env が更新されない）:

```bash
docker compose up -d
```

以降はソース変更が自動で反映される（`docker compose restart` 不要）。

## 検証

`docker compose up -d` 後に `touch src/server.ts` すると、ログに

```
[tsx] change in ./src/server.ts Restarting...
```

が出て新 pid で再 listen することを確認済み。ポーリング監視が効いている。

## 補足

- 本番（Lambda）には無関係。ローカル開発の DX 改善のみ。
- ポーリングは常時動くため微小な CPU 使用はあるが、開発用途では許容範囲。負荷が気になれば `CHOKIDAR_INTERVAL` を上げる。
