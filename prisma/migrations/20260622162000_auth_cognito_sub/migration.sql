-- AlterTable: Cognito 管理に移行（password 削除・cognito_sub 追加）
ALTER TABLE "users" DROP COLUMN "password";
ALTER TABLE "users" ADD COLUMN "cognito_sub" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_cognito_sub_key" ON "users"("cognito_sub");
