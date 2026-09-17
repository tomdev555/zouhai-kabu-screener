// 最新データ取得スクリプト。
// 実行方法: npm run refresh
// J-Quants APIキーが設定されていればそちらから、未設定ならモックデータから取得する。
// cron / タスクスケジューラなどで定期実行することで「常に最新の情報を反映」を実現する。

import { prisma } from "../src/lib/db";
import { refreshAllData } from "../src/lib/refresh";

async function main() {
  const summary = await refreshAllData((done, total) => {
    if (done % 10 === 0) console.log(`[refresh] ${done}/${total} 銘柄処理済み`);
  });

  console.log(
    `[refresh] データソース: ${summary.provider}${summary.isMock ? " (モックデータ)" : ""}`
  );
  console.log(
    `[refresh] 完了。全${summary.stockCount}銘柄中 ${summary.passedCount}銘柄が全条件を満たし、上位${summary.targetCount}銘柄をランキングしました。`
  );
}

main()
  .catch((err) => {
    console.error("[refresh] エラー:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
