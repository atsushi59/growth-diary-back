import type { FastifyPluginAsync } from "fastify";
import { findChildByIdForUser } from "../repositories/children.repository.js";
import * as uploadService from "../services/upload.service.js";

// 画像用途ごとの「所有チェック」と「キー接頭辞」の定義。
// アルバム・離乳食など新しい用途はここに1件足すだけで対応できる（共通処理は service 側）。
type UploadPurpose = {
  // 対象が認証ユーザー本人のものかを判定する。本人でない・存在しないなら false。
  verifyOwnership: (userId: string, targetId: string) => Promise<boolean>;
  // S3 オブジェクトキーの接頭辞を組み立てる。
  buildKeyPrefix: (targetId: string) => string;
};

const UPLOAD_PURPOSES: Record<string, UploadPurpose> = {
  child: {
    verifyOwnership: async (userId, targetId) => {
      const child = await findChildByIdForUser(targetId, userId);
      return child !== null;
    },
    buildKeyPrefix: (targetId) => `children/${targetId}`,
  },
};

type UploadUrlBody = {
  purpose?: string;
  targetId?: string;
  contentType?: string;
};

const uploadsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /uploads/image-url 画像アップロード用の署名付き URL を発行する（要認証・所有チェック）
  fastify.post<{ Body: UploadUrlBody }>("/image-url", async (request, reply) => {
    const { purpose, targetId, contentType } = request.body ?? {};

    if (!purpose || !targetId || !contentType) {
      return reply
        .code(400)
        .send({ error: "purpose, targetId, contentType は必須です" });
    }

    // hasOwn で自前のキーだけ見る（constructor 等のプロトタイプを拾わないため）
    if (!Object.hasOwn(UPLOAD_PURPOSES, purpose)) {
      return reply.code(400).send({ error: `未対応の purpose です: ${purpose}` });
    }
    const purposeConfig = UPLOAD_PURPOSES[purpose];

    if (!uploadService.isAllowedImageType(contentType)) {
      return reply
        .code(400)
        .send({ error: "対応していない画像形式です（jpeg / png / webp のみ）" });
    }

    // 他人の対象・存在しない対象は、存在を隠すため 404 を返す。
    const isOwner = await purposeConfig.verifyOwnership(
      request.user.cognitoSub,
      targetId
    );
    if (!isOwner) {
      return reply.code(404).send({ error: "対象が見つかりません" });
    }

    const result = await uploadService.createImageUploadUrl(
      purposeConfig.buildKeyPrefix(targetId),
      contentType
    );
    return reply.send(result);
  });
};

export default uploadsRoutes;
