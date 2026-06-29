// AI(Python/FastAPI) サービスのベースURL。
// compose では http://ai-service:8000（compose.yml が注入）。
// ホスト直実行ではホスト公開ポートの http://localhost:8001（8000 は DynamoDB Local が使用）。
export const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8001";
