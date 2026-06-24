# Lambda(nodejs22.x) とメジャーバージョンを揃える（slim でサイズ削減＋固定）
FROM node:22-slim

WORKDIR /app

# 依存だけ先にコピーしてレイヤキャッシュを効かせる
COPY package*.json ./
RUN npm install

# 残りのソースをコピー
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
