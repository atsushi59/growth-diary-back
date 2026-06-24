# Lambda(nodejs22.x) とメジャーバージョンを揃える（slim でサイズ削減＋固定）
FROM node:22-slim

WORKDIR /app

# 依存だけ先にコピーしてレイヤキャッシュを効かせる
COPY package*.json ./
RUN npm install

# 残りのソースをコピー
COPY . .

EXPOSE 3000

# 起動時に lockfile 通り依存を同期してから dev サーバーを立ち上げる
# （node_modules を匿名ボリュームに隔離しているため、依存追加時もここで取り込む。
#   npm ci は lockfile を書き換えないので、マウントした package-lock.json が汚れない）
CMD ["sh", "-c", "npm ci && npm run dev"]
