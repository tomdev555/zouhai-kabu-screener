// データ取得〜スクリーニング再計算までの一連の処理。
// scripts/refresh-data.ts (CLI/定期実行用) と /api/refresh (設定画面のボタン) の両方から使う。

import { prisma } from "./db";
import { getDataProvider, isUsingMockData } from "./data-sources";
import { isEdinetConfigured } from "./data-sources/edinet-client";
import { fetchLongHistoryFinancials } from "./data-sources/edinet-history";
import { detectSpecialDividendYears } from "./screening/rules";
import { DEFAULT_CRITERIA } from "./screening/types";
import { runScreeningAndPersist } from "./screening/engine";
import type { FinancialYearRecord, PriceBar, StockMasterRecord } from "./data-sources/types";

export interface RefreshSummary {
  provider: string;
  isMock: boolean;
  stockCount: number;
  passedCount: number;
  targetCount: number;
}

// ネットワーク取得はまとめて並列化する。DB書き込み(SQLite)は書き込み競合を避けるため直列のまま。
const FETCH_CONCURRENCY = Number(process.env.FETCH_CONCURRENCY) || 4;

export async function refreshAllData(
  onProgress?: (done: number, total: number) => void
): Promise<RefreshSummary> {
  const provider = getDataProvider();
  const masters = await provider.fetchAllStockMaster();

  let done = 0;
  for (let i = 0; i < masters.length; i += FETCH_CONCURRENCY) {
    const batch = masters.slice(i, i + FETCH_CONCURRENCY);

    // 1) 通信は並列
    const fetched = await Promise.all(
      batch.map(async (m) => {
        try {
          const [prices, providerFinancials] = await Promise.all([
            provider.fetchPriceHistory(m.code),
            provider.fetchFinancialHistory(m.code),
          ]);
          const financials = await supplementWithEdinetIfNeeded(m.code, providerFinancials);
          return { master: m, prices, financials };
        } catch (err) {
          console.warn(`[refresh] ${m.code} の取得に失敗:`, err instanceof Error ? err.message : err);
          return { master: m, prices: [], financials: [] };
        }
      })
    );

    // 2) 書き込みは直列
    for (const { master: m, prices, financials } of fetched) {
      await persistStock(m, prices, financials);
      done++;
      onProgress?.(done, masters.length);
    }
  }

  const results = await runScreeningAndPersist(DEFAULT_CRITERIA);
  const passedCount = results.filter((r) => r.passedAllRules).length;

  return {
    provider: provider.name,
    isMock: isUsingMockData(),
    stockCount: results.length,
    passedCount,
    targetCount: DEFAULT_CRITERIA.targetCount,
  };
}

async function persistStock(
  m: StockMasterRecord,
  prices: PriceBar[],
  financials: FinancialYearRecord[]
): Promise<void> {
  {
    await prisma.stock.upsert({
      where: { code: m.code },
      create: {
        code: m.code,
        name: m.name,
        nameEnglish: m.nameEnglish,
        market: m.market,
        sector33: m.sector33,
        sector17: m.sector17,
        currentPrice: m.currentPrice,
        per: m.per,
        pbr: m.pbr,
        marketCap: m.marketCap,
      },
      update: {
        name: m.name,
        nameEnglish: m.nameEnglish,
        market: m.market,
        sector33: m.sector33,
        sector17: m.sector17,
        currentPrice: m.currentPrice,
        per: m.per,
        pbr: m.pbr,
        marketCap: m.marketCap,
      },
    });

    if (prices.length > 0) {
      const latest = prices[prices.length - 1];
      await prisma.stock.update({ where: { code: m.code }, data: { currentPrice: latest.close } });

      // 保存済みの最新日以降の分だけを追加する。
      // 毎回全期間を書き直すと1銘柄あたり千件以上の更新になり、全銘柄では非現実的な時間がかかるため。
      // (過去の四本値が後から修正されるケースは考慮していない)
      const newest = await prisma.priceDaily.findFirst({
        where: { stockCode: m.code },
        orderBy: { date: "desc" },
        select: { date: true },
      });
      const newestDate = newest?.date.toISOString().slice(0, 10) ?? "";
      const newBars = prices.filter((bar) => bar.date > newestDate);

      if (newBars.length > 0) {
        await prisma.priceDaily.createMany({
          data: newBars.map((bar) => ({
            stockCode: m.code,
            date: new Date(bar.date),
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: BigInt(Math.round(bar.volume)),
          })),
        });
      }
    }

    if (financials.length > 0) {
      const specialYears = detectSpecialDividendYears(financials, DEFAULT_CRITERIA.specialDividendSpikeRatio);

      // 最新年度レコードに付いてくる「現在のスナップショット」(会社予想配当・時価総額)を Stock に転記する
      const latest = financials[financials.length - 1];
      if (latest.forwardDividendPerShare !== undefined || latest.marketCap !== undefined) {
        await prisma.stock.update({
          where: { code: m.code },
          data: { forwardDividendPerShare: latest.forwardDividendPerShare, marketCap: latest.marketCap },
        });
      }

      const financialUpserts = financials.map((f) =>
        prisma.financialStatement.upsert({
          where: { stockCode_fiscalYear: { stockCode: m.code, fiscalYear: f.fiscalYear } },
          create: {
            stockCode: m.code,
            fiscalYear: f.fiscalYear,
            fiscalPeriodEndDate: new Date(f.fiscalPeriodEndDate),
            eps: f.eps,
            bps: f.bps,
            netSales: f.netSales,
            operatingProfit: f.operatingProfit,
            ordinaryProfit: f.ordinaryProfit,
            netIncome: f.netIncome,
            totalAssets: f.totalAssets,
            netAssets: f.netAssets,
            equityRatio: f.equityRatio,
            debtToEquity: f.debtToEquity,
            interestBearingDebt: f.interestBearingDebt,
            cashAndEquivalents: f.cashAndEquivalents,
            isForecast: f.isForecast ?? false,
          },
          update: {
            fiscalPeriodEndDate: new Date(f.fiscalPeriodEndDate),
            eps: f.eps,
            bps: f.bps,
            netSales: f.netSales,
            operatingProfit: f.operatingProfit,
            ordinaryProfit: f.ordinaryProfit,
            netIncome: f.netIncome,
            totalAssets: f.totalAssets,
            netAssets: f.netAssets,
            equityRatio: f.equityRatio,
            debtToEquity: f.debtToEquity,
            interestBearingDebt: f.interestBearingDebt,
            cashAndEquivalents: f.cashAndEquivalents,
            isForecast: f.isForecast ?? false,
          },
        })
      );

      const dividendUpserts = financials
        .filter((f) => f.dividendPerShare !== undefined)
        .map((f) =>
          prisma.dividendRecord.upsert({
            where: { stockCode_fiscalYear: { stockCode: m.code, fiscalYear: f.fiscalYear } },
            create: {
              stockCode: m.code,
              fiscalYear: f.fiscalYear,
              dividendPerShare: f.dividendPerShare!,
              isSpecial: specialYears.has(f.fiscalYear),
            },
            update: {
              dividendPerShare: f.dividendPerShare!,
              isSpecial: specialYears.has(f.fiscalYear),
            },
          })
        );

      await prisma.$transaction([...financialUpserts, ...dividendUpserts]);
    }
  }
}

/**
 * J-Quants(または他のプロバイダ)の財務履歴が「減配なし年数」の判定に必要な年数に
 * 足りない場合、EDINETの長期履歴で不足分を補う。
 * EDINET_API_KEYが未設定、またはインデックス未構築(npm run edinet:index未実行)の場合は
 * 何もせず元のデータをそのまま返す。
 */
async function supplementWithEdinetIfNeeded(
  ticker: string,
  financials: FinancialYearRecord[]
): Promise<FinancialYearRecord[]> {
  if (!isEdinetConfigured()) return financials;

  const years = financials.map((f) => f.fiscalYear);
  const span = years.length > 0 ? Math.max(...years) - Math.min(...years) + 1 : 0;
  const yearsNeeded = DEFAULT_CRITERIA.minDividendCutFreeYears + 2;
  if (span >= yearsNeeded) return financials;

  try {
    const supplement = await fetchLongHistoryFinancials(ticker, yearsNeeded);
    const existingYears = new Set(years);
    const merged = [...financials];
    for (const s of supplement) {
      if (!existingYears.has(s.fiscalYear)) {
        merged.push(s);
        existingYears.add(s.fiscalYear);
      }
    }
    return merged.sort((a, b) => a.fiscalYear - b.fiscalYear);
  } catch (err) {
    console.warn(`[refresh] EDINET補完に失敗 (${ticker}):`, err);
    return financials;
  }
}
