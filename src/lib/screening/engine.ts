import { prisma } from "../db";
import {
  compositeScore,
  evaluateDividendCutFreeYears,
  evaluateDividendYield,
  evaluateEpsTrend,
  evaluateFinancialHealth,
  evaluateYieldRangePercentile,
  passesCriteria,
} from "./rules";
import { DEFAULT_CRITERIA, type RuleBreakdown, type ScreeningCriteria, type StockScreeningResult } from "./types";
import type { FinancialYearRecord, PriceBar } from "../data-sources/types";

async function loadStockInputs(stockCode: string) {
  const [financials, dividends, prices] = await Promise.all([
    prisma.financialStatement.findMany({
      where: { stockCode },
      orderBy: { fiscalYear: "asc" },
    }),
    prisma.dividendRecord.findMany({
      where: { stockCode },
      orderBy: { fiscalYear: "asc" },
    }),
    prisma.priceDaily.findMany({
      where: { stockCode },
      orderBy: { date: "asc" },
    }),
  ]);

  // ルール評価関数は FinancialYearRecord (eps + dividendPerShare が同居する形) を期待するため結合する
  const dividendByYear = new Map(dividends.map((d) => [d.fiscalYear, Number(d.dividendPerShare)]));
  const merged: FinancialYearRecord[] = financials.map((f) => ({
    fiscalYear: f.fiscalYear,
    fiscalPeriodEndDate: f.fiscalPeriodEndDate.toISOString().slice(0, 10),
    eps: f.eps ? Number(f.eps) : undefined,
    bps: f.bps ? Number(f.bps) : undefined,
    equityRatio: f.equityRatio ? Number(f.equityRatio) : undefined,
    debtToEquity: f.debtToEquity ? Number(f.debtToEquity) : undefined,
    dividendPerShare: dividendByYear.get(f.fiscalYear),
    isForecast: f.isForecast,
  }));

  const priceBars: PriceBar[] = prices.map((p) => ({
    date: p.date.toISOString().slice(0, 10),
    open: Number(p.open),
    high: Number(p.high),
    low: Number(p.low),
    close: Number(p.close),
    volume: Number(p.volume),
  }));

  return { merged, priceBars };
}

async function evaluateStock(
  stock: { code: string; name: string; sector33: string | null; currentPrice: unknown },
  criteria: ScreeningCriteria
): Promise<StockScreeningResult | null> {
  const { merged, priceBars } = await loadStockInputs(stock.code);
  if (merged.length === 0) return null;

  const currentPrice = stock.currentPrice ? Number(stock.currentPrice) : null;
  const latestFinancial = merged[merged.length - 1];

  const cutResult = evaluateDividendCutFreeYears(merged, criteria.specialDividendSpikeRatio);
  const epsTrend = evaluateEpsTrend(merged);
  const dividendYield = evaluateDividendYield(currentPrice, latestFinancial?.dividendPerShare);
  const yieldRange = evaluateYieldRangePercentile(priceBars, merged, currentPrice);
  const financialHealth = evaluateFinancialHealth(
    latestFinancial?.equityRatio,
    latestFinancial?.debtToEquity,
    criteria
  );

  const passed = passesCriteria(
    {
      dividendYield,
      cutFreeYears: cutResult.cutFreeYears,
      financialHealthPass: financialHealth.pass,
      epsScore: epsTrend.score,
    },
    criteria
  );

  const score = compositeScore({
    dividendYield,
    cutFreeYears: cutResult.cutFreeYears,
    financialHealth,
    epsScore: epsTrend.score,
    yieldPercentile: yieldRange.percentileInRange,
  });

  const breakdown: RuleBreakdown = {
    dividendYield: {
      value: dividendYield,
      pass:
        dividendYield !== null &&
        dividendYield >= criteria.minDividendYield &&
        dividendYield <= criteria.maxDividendYield,
    },
    dividendCutFree: {
      years: cutResult.cutFreeYears,
      pass: cutResult.cutFreeYears >= criteria.minDividendCutFreeYears,
    },
    financialHealth,
    epsTrend: { ...epsTrend, pass: epsTrend.score >= criteria.minEpsTrendScore },
    yieldRange,
    specialDividendYears: cutResult.normalizedSeries.filter((s) => s.wasSpecial).map((s) => s.fiscalYear),
  };

  return {
    code: stock.code,
    name: stock.name,
    sector: stock.sector33 ?? undefined,
    currentPrice,
    breakdown,
    passedAllRules: passed,
    compositeScore: score,
    rank: null,
  };
}

export async function computeScreeningForStock(
  code: string,
  criteria: ScreeningCriteria = DEFAULT_CRITERIA
): Promise<StockScreeningResult | null> {
  const stock = await prisma.stock.findUnique({ where: { code } });
  if (!stock) return null;
  return evaluateStock(stock, criteria);
}

export async function computeScreeningFromDb(
  criteria: ScreeningCriteria = DEFAULT_CRITERIA
): Promise<StockScreeningResult[]> {
  const stocks = await prisma.stock.findMany();
  const results: StockScreeningResult[] = [];

  for (const stock of stocks) {
    const result = await evaluateStock(stock, criteria);
    if (result) results.push(result);
  }

  // 合格銘柄を優先し、同じ合格状態内ではスコアの高い順に並べる。
  // 合格銘柄が targetCount に満たない場合は次点のスコア順で埋める(UIで基準未達と分かるようにする)。
  results.sort((a, b) => {
    if (a.passedAllRules !== b.passedAllRules) return a.passedAllRules ? -1 : 1;
    return b.compositeScore - a.compositeScore;
  });

  results.forEach((r, i) => {
    if (i < criteria.targetCount) r.rank = i + 1;
  });

  return results;
}

export async function runScreeningAndPersist(
  criteria: ScreeningCriteria = DEFAULT_CRITERIA
): Promise<StockScreeningResult[]> {
  const results = await computeScreeningFromDb(criteria);

  const run = await prisma.screeningRun.create({
    data: { criteria: JSON.stringify(criteria) },
  });

  await prisma.screeningResult.createMany({
    data: results.map((r) => ({
      screeningRunId: run.id,
      stockCode: r.code,
      dividendYield: r.breakdown.dividendYield.value,
      epsTrendScore: r.breakdown.epsTrend.score,
      dividendCutFreeYears: r.breakdown.dividendCutFree.years,
      equityRatio: r.breakdown.financialHealth.metric === "equityRatio" ? r.breakdown.financialHealth.value : null,
      debtToEquity: r.breakdown.financialHealth.metric === "debtToEquity" ? r.breakdown.financialHealth.value : null,
      yieldRangePercentile: r.breakdown.yieldRange.percentileInRange,
      passedAllRules: r.passedAllRules,
      compositeScore: r.compositeScore,
      rank: r.rank,
      ruleBreakdown: JSON.stringify(r.breakdown),
    })),
  });

  return results;
}
