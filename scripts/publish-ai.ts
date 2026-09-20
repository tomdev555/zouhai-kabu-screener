// ローカルで生成したAI総評・会社概要を、公開サイト用のJSONに書き出す。
// 実行方法: npm run publish:ai
//
// 書き出し先は content/ai/ (git管理対象)。コミットしてpushすると、公開サイトのビルドがこれを読んで表示する。
// 書き出すのは生成結果のテキストだけで、APIキー・プロンプト・元データ・トークン数などは含めない。
// 念のため、書き出す内容に .env.local のキーらしき文字列が含まれていないかを検査し、含まれていれば中断する。

import { promises as fs } from "fs";
import path from "path";
import { prisma } from "../src/lib/db";
import { ProfileSchema, ReviewSchema, type ProfileRecord, type ReviewRecord } from "../src/lib/ai/schemas";
import { assertNoSecrets, loadSecretValues } from "../src/lib/ai/secret-guard";

const OUT_DIR = path.join(process.cwd(), "content", "ai");

async function main() {
  const secrets = await loadSecretValues();
  await fs.mkdir(OUT_DIR, { recursive: true });

  const [reviewRows, profileRows] = await Promise.all([
    prisma.aiReview.findMany({ include: { stock: { select: { name: true } } }, orderBy: { generatedAt: "desc" } }),
    prisma.companyProfile.findMany({ include: { stock: { select: { name: true } } }, orderBy: { generatedAt: "desc" } }),
  ]);

  const reviews: ReviewRecord[] = [];
  for (const row of reviewRows) {
    const parsed = ReviewSchema.safeParse(JSON.parse(row.content || "null"));
    if (!parsed.success) continue; // 構造化できていないものは公開しない
    reviews.push({
      stockCode: row.stockCode,
      stockName: row.stock.name,
      generatedAt: row.generatedAt.toISOString(),
      model: row.model,
      review: parsed.data,
    });
  }

  const profiles: ProfileRecord[] = [];
  for (const row of profileRows) {
    const parsed = ProfileSchema.safeParse(JSON.parse(row.content || "null"));
    if (!parsed.success) continue;
    profiles.push({
      stockCode: row.stockCode,
      stockName: row.stock.name,
      generatedAt: row.generatedAt.toISOString(),
      model: row.model,
      profile: parsed.data,
    });
  }

  const reviewsJson = JSON.stringify({ publishedAt: new Date().toISOString(), reviews }, null, 1);
  const profilesJson = JSON.stringify({ publishedAt: new Date().toISOString(), profiles }, null, 1);
  assertNoSecrets(reviewsJson, secrets);
  assertNoSecrets(profilesJson, secrets);

  await fs.writeFile(path.join(OUT_DIR, "reviews.json"), reviewsJson, "utf-8");
  await fs.writeFile(path.join(OUT_DIR, "profiles.json"), profilesJson, "utf-8");

  console.log(`[publish:ai] content/ai/reviews.json  … AI総評 ${reviews.length}件`);
  console.log(`[publish:ai] content/ai/profiles.json … 会社概要 ${profiles.length}件`);
  console.log("[publish:ai] 秘密情報の混入チェック: OK");
  console.log("[publish:ai] 完了。git commit → push すると公開サイトに反映されます。");
}

main()
  .catch((err) => {
    console.error("[publish:ai] エラー:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
