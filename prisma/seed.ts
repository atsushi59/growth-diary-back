import { prisma } from "../src/prisma.js";
import { DUMMY_USER } from "../src/auth/dummyUser.js";

/** ダミー認証用の固定テストユーザーを投入する（再実行しても重複しない） */
async function main() {
  await prisma.user.upsert({
    where: { cognitoSub: DUMMY_USER.cognitoSub },
    update: {},
    create: { ...DUMMY_USER },
  });
  console.log(`seed 完了: ダミーユーザー (${DUMMY_USER.cognitoSub})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
