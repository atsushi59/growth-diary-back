import awsLambdaFastify from "@fastify/aws-lambda";
import fastify from "./server.js"; // server.ts から設定済みのインスタンスを読み込む

// FastifyアプリをLambda用の翻訳機でラップ
const proxy = awsLambdaFastify(fastify);

// template.yaml の Handler: lambda.handler から呼び出されるエントリーポイント
export const handler = async (event: any, context: any) => {
	return proxy(event, context);
};