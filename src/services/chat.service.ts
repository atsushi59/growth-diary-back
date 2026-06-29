import { AI_SERVICE_URL } from "../config/ai.js";

export type ChatReply = { reply: string };

// AI サービス応答待ちの上限（ミリ秒）。ハング時に Node のリクエストが無限待ちになるのを防ぐ。
const AI_REQUEST_TIMEOUT_MS = 15000;

/**
 * AI サービス(Python/FastAPI)へメッセージを中継して応答を得る。
 * @param message ユーザーの入力メッセージ
 * @returns AI の応答
 */
export async function relayChat(message: string): Promise<ChatReply> {
  const res = await fetch(`${AI_SERVICE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`AI service responded ${res.status}`);
  }

  return (await res.json()) as ChatReply;
}
