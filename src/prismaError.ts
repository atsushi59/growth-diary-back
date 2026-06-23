import { Prisma } from "../generated/prisma/client.js";

/**
 * Prisma の「対象レコードなし」(P2025) エラーかを判定する。
 * update/delete が where にマッチしなかったケースを 404 に振り分けるために使う。
 * @param error catch した例外
 * @returns P2025 なら true
 */
export function isRecordNotFoundError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}
