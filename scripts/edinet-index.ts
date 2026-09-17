// EDINET提出書類インデックスの構築スクリプト。
// 実行方法: npm run edinet:index
//
// 有価証券報告書(docTypeCode=120)を証券コードで検索できるようにするため、
// 提出書類一覧(documents.json)を日付単位でスキャンしてローカルにインデックスを作る。
// 1件の報告書が5年分をカバーするため、約5年おきの窓(デフォルト10年分=2窓)をスキャンする。
// 低速(1日1リクエスト、300ms間隔)なため、初回は数分〜十数分かかる。
// 一度作ったインデックスは .cache/edinet/ に保存され、次回以降は未スキャン分のみ処理する。

import { isEdinetConfigured } from "../src/lib/data-sources/edinet-client";
import { buildScanWindows, scanFilingIndex } from "../src/lib/data-sources/edinet-history";
import { DEFAULT_CRITERIA } from "../src/lib/screening/types";

async function main() {
  if (!isEdinetConfigured()) {
    console.error("[edinet:index] EDINET_API_KEY が設定されていません。.env.local を確認してください。");
    process.exitCode = 1;
    return;
  }

  const yearsBack = DEFAULT_CRITERIA.minDividendCutFreeYears + 2;
  const windows = buildScanWindows(yearsBack);
  console.log(`[edinet:index] ${windows.length}個の期間をスキャンします (対象: 過去${yearsBack}年分)`);

  for (const [i, w] of windows.entries()) {
    console.log(
      `[edinet:index] (${i + 1}/${windows.length}) ${w.from.toISOString().slice(0, 10)} 〜 ${w.to
        .toISOString()
        .slice(0, 10)} をスキャン中...`
    );
    await scanFilingIndex(w.from, w.to, (done, total, date) => {
      if (done % 20 === 0 || done === total) {
        console.log(`[edinet:index]   ${done}/${total} (${date})`);
      }
    });
  }

  console.log("[edinet:index] 完了。npm run refresh を実行すると長期履歴が補完されます。");
}

main().catch((err) => {
  console.error("[edinet:index] エラー:", err);
  process.exitCode = 1;
});
