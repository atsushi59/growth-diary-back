# Lambda(nodejs22.x) とメジャーバージョンを揃える（slim でサイズ削減＋固定）
FROM node:22-slim

# Prisma が必要とする OpenSSL を入れる
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 依存だけ先にコピーしてレイヤキャッシュを効かせる
COPY package*.json ./
RUN npm install

# 残りのソースをコピー
COPY . .

EXPOSE 3000

# 起動時に prisma generate してから dev 起動（このとき DATABASE_URL が入っている）
CMD ["sh", "-c", "npx prisma generate && npm run dev"]