import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/plugins/prisma.js";
import { DUMMY_USER } from "../src/config/dummyUser.js";

type GrowthStandardSeed = {
  gender: string;
  ageMonths: number;
  metric: string;
  min: number;
  max: number;
};

/** ダミー認証用の固定テストユーザーを投入する（再実行しても重複しない） */
async function seedDummyUser() {
  await prisma.user.upsert({
    where: { cognitoSub: DUMMY_USER.cognitoSub },
    update: {},
    create: { ...DUMMY_USER },
  });
  console.log(`seed 完了: ダミーユーザー (${DUMMY_USER.cognitoSub})`);
}

/** 発育曲線マスタ（出典: こども家庭庁 令和5年乳幼児身体発育調査）を JSON から投入する */
async function seedGrowthStandards() {
  const dataPath = fileURLToPath(
    new URL("./data/growth_standards.json", import.meta.url)
  );
  const standards: GrowthStandardSeed[] = JSON.parse(
    readFileSync(dataPath, "utf-8")
  );

  for (const standard of standards) {
    await prisma.growthStandard.upsert({
      where: {
        gender_ageMonths_metric: {
          gender: standard.gender,
          ageMonths: standard.ageMonths,
          metric: standard.metric,
        },
      },
      update: { min: standard.min, max: standard.max },
      create: standard,
    });
  }
  console.log(`seed 完了: 発育曲線マスタ (${standards.length} 件)`);
}

/** すべての seed を実行する */
async function main() {
  await seedDummyUser();
  await seedGrowthStandards();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
