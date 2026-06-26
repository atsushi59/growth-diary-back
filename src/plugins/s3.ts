import { S3Client } from "@aws-sdk/client-s3";

// S3_ENDPOINT があればそこへ接続（ローカルの S3 互換エミュレータ用）。
// Lambda 等の本番では未設定で、SDK が実 S3 に接続する。
// region / credentials は env（AWS_REGION 等）から SDK が読む。
export const s3 = new S3Client(
  process.env.S3_ENDPOINT
    ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true }
    : {}
);
