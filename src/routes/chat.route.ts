import type { FastifyPluginAsync } from "fastify";
import * as chatService from "../services/chat.service.js";

type ChatBody = { message?: string };

const chatRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /chat AIボットへ中継する（要認証。認証はグローバルフックで担保）
  fastify.post<{ Body: ChatBody }>("/", async (request, reply) => {
    // body は実行時に任意の型なので、文字列であることを確認してから trim する
    const raw = request.body?.message;
    if (typeof raw !== "string" || !raw.trim()) {
      return reply.code(400).send({ error: "message は必須です" });
    }
    const message = raw.trim();

    try {
      const result = await chatService.relayChat(message);
      return reply.send(result);
    } catch (error) {
      request.log.error(error, "AIサービスの呼び出しに失敗しました");
      return reply.code(502).send({ error: "AIサービスでエラーが発生しました" });
    }
  });
};

export default chatRoutes;
