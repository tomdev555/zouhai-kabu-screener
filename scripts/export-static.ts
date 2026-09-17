// 共有用の静的サイト向けに、DBの内容をJSONファイルへ書き出す。
// 実行方法: npm run export:data
//
// 書き出し先:
//   public/data/screening.json      … スクリーニング結果(一覧ページ用)
//   public/data/stocks/{code}.json  … 個別銘柄の株価・配当・EPS(詳細ページ用)
//
// 静的サイトはこのJSONだけを読むため、公開時にサーバーもDBも不要になる。

import { promises as fs } from "fs";
import path from "path";
import { prisma } from "../src/lib/db";
import { computeScreeningFromDb } from "../src/lib/screening/engine";
import { DEFAULT_CRITERIA } from "../src/lib/screening/types";
import { getDataSourceLabel } from "../src/lib/data-sources";

const DATA_DIR = path.join(process.cwd(), "public", "data");
const STOCKS_DIR = path.join(DATA_DIR, "stocks");

// 詳細ページ用に株価を保存する期間 (ファイルサイズを抑えるため一覧上位のみ・期間も限定)
const DETAIL_PRICE_YEARS = 3;

async function main() {
  await fs.mkdir(STOCKS_DIR, { recursive: true });

  const results = await computeScreeningFromDb(DEFAULT_CRITERIA);
  const ranked = results.filter((r) => r.rank !== null).sort((a, b) => a.rank! - b.rank!);

  const screening = {
    generatedAt: new Date().toISOString(),
    dataSource: getDataSourceLabel(),
    criteria: DEFAULT_CRITERIA,
    totalEvaluated: results.length,
    passedCount: results.filter((r) => r.passedAllRules).length,
    results: ranked,
  };

  await fs.writeFile(path.join(DATA_DIR, "screening.json"), JSON.stringify(screening), "utf-8");
  console.log(`[export] screening.json (${ranked.length}銘柄 / 評価対象${results.length}銘柄)`);

  // 古い個別銘柄JSONが残らないように一度削除する
  for (const file of await fs.readdir(STOCKS_DIR).catch(() => [])) {
    if (file.endsWith(".json")) await fs.unlink(path.join(STOCKS_DIR, file));
  }

  const from = new Date();
  from.setFullYear(from.getFullYear() - DETAIL_PRICE_YEARS);

  for (const r of ranked) {
    const [stock, prices] = await Promise.all([
      prisma.stock.findUnique({
        where: { code: r.code },
        include: {
          financials: { orderBy: { fiscalYear: "asc" } },
          dividends: { orderBy: { fiscalYear: "asc" } },
        },
      }),
      prisma.priceDaily.findMany({
        where: { stockCode: r.code, date: { gte: from } },
        orderBy: { date: "asc" },
      }),
    ]);
    if (!stock) continue;

    const dividendByYear = new Map(stock.dividends.map((d) => [d.fiscalYear, d]));
    const years = new Set([
      ...stock.financials.map((f) => f.fiscalYear),
      ...stock.dividends.map((d) => d.fiscalYear),
    ]);
    const financialByYear = new Map(stock.financials.map((f) => [f.fiscalYear, f]));

    const detail = {
      code: stock.code,
      name: stock.name,
      market: stock.market,
      sector33: stock.sector33,
      currentPrice: stock.currentPrice ? Number(stock.currentPrice) : null,
      screening: r,
      prices: prices.map((p) => ({
        time: p.date.toISOString().slice(0, 10),
        open: Number(p.open),
        high: Number(p.high),
        low: Number(p.low),
        close: Number(p.close),
        volume: Number(p.volume),
      })),
      epsDividend: Array.from(years)
        .sort((a, b) => a - b)
        .map((fiscalYear) => {
          const f = financialByYear.get(fiscalYear);
          const d = dividendByYear.get(fiscalYear);
          return {
            fiscalYear,
            eps: f?.eps ? Number(f.eps) : null,
            dividendPerShare: d?.dividendPerShare ? Number(d.dividendPerShare) : null,
            isSpecial: d?.isSpecial ?? false,
          };
        }),
    };

    await fs.writeFile(path.join(STOCKS_DIR, `${stock.code}.json`), JSON.stringify(detail), "utf-8");
  }

  console.log(`[export] stocks/*.json (${ranked.length}件)`);
  console.log("[export] 完了");
}

main()
  .catch((err) => {
    console.error("[export] エラー:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
