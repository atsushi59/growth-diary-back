import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { TABLES } from "../src/config/dynamodb.js";
import { DUMMY_USER } from "../src/config/dummyUser.js";
import { ddb } from "../src/plugins/dynamodb.js";
import { batchWrite } from "../src/utils/batchWrite.js";

type GrowthStandardSeed = {
  gender: string;
  ageMonths: number;
  metric: string;
  min: number;
  max: number;
};

/** ダミー認証用の固定テストユーザーを投入する。 */
async function seedDummyUser() {
  await ddb.send(
    new PutCommand({
      TableName: TABLES.users,
      Item: { ...DUMMY_USER, createdAt: new Date().toISOString() },
    })
  );
  console.log(`seed 完了: ダミーユーザー (${DUMMY_USER.cognitoSub})`);
}

/** 発育曲線マスタ（出典: こども家庭庁 令和5年乳幼児身体発育調査）を JSON から投入する。 */
async function seedGrowthStandards() {
  const dataPath = fileURLToPath(
    new URL("../data/growth_standards.json", import.meta.url)
  );
  const standards: GrowthStandardSeed[] = JSON.parse(
    readFileSync(dataPath, "utf-8")
  );

  // SK(metricAge) を付けてアイテム化。ageMonths はゼロ埋めして文字列ソートが効くようにする。
  const items = standards.map((standard) => ({
    ...standard,
    metricAge: `${standard.metric}#${String(standard.ageMonths).padStart(3, "0")}`,
  }));

  await batchWrite(
    TABLES.growthStandards,
    items.map((item) => ({ PutRequest: { Item: item } }))
  );
  console.log(`seed 完了: 発育曲線マスタ (${items.length} 件)`);
}

/** すべての seed を実行する。 */
async function main() {
  await seedDummyUser();
  await seedGrowthStandards();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
