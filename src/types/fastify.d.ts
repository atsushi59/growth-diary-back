import "fastify";
import type { User } from "../../generated/prisma/client.js";

// 認証フックが詰める users レコードを req.user として型付けする。
declare module "fastify" {
  interface FastifyRequest {
    user: User;
  }
}
