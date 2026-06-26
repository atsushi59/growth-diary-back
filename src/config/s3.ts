// 画像保存用 S3 バケット名。Lambda では template.yaml が env で実バケット名を渡す。
// ローカル/テストでは未設定なら下のデフォルト名を使う（署名生成自体は AWS へ通信しない）。
export const IMAGES_BUCKET = process.env.IMAGES_BUCKET ?? "growth-diary-images-local";
