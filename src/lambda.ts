import awsLambdaFastify from "@fastify/aws-lambda";
import { buildApp } from "./app.js";

// Fastify アプリを Lambda 用ハンドラにラップする。
// template.yaml の Handler: lambda.handler から呼び出されるエントリーポイント。
export const handler = awsLambdaFastify(buildApp({ logger: true }));
