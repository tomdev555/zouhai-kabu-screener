import { prisma } from "../db";
import {
  compositeScore,
  evaluateCash,
  evaluateDividendCutFreeYears,
  evaluateDividendYieldCheck,
  evaluateEpsTrend,
  evaluateFinancialHealth,
  evaluateValuation,
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
    cashAndEquivalents: f.cashAndEquivalents ? Number(f.cashAndEquivalents) : undefined,
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

type StockForScreening = {
  code: string;
  name: string;
  sector33: string | null;
  currentPrice: unknown;
  forwardDividendPerShare: unknown;
  marketCap: unknown;
};

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 評価期間(月)ぶん前の終値と比べた騰落率 (%) */
function priceChangeOverMonths(priceBars: PriceBar[], months: number, currentPrice: number | null): number | null {
  if (!currentPrice || priceBars.length === 0) return null;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const base = priceBars.find((b) => b.date >= cutoffStr);
  if (!base || !base.close) return null;
  return Math.round(((currentPrice - base.close) / base.close) * 1000) / 10;
}

async function evaluateStock(stock: StockForScreening, criteria: ScreeningCriteria): Promise<StockScreeningResult | null> {
  const { merged, priceBars } = await loadStockInputs(stock.code);
  if (merged.length === 0) return null;

  const currentPrice = num(stock.currentPrice);
  const latestFinancial = merged[merged.length - 1];

  const cutResult = evaluateDividendCutFreeYears(merged, criteria.specialDividendSpikeRatio);
  const epsTrend = evaluateEpsTrend(merged);
  const dividendYield = evaluateDividendYieldCheck(
    currentPrice,
    latestFinancial?.dividendPerShare,
    num(stock.forwardDividendPerShare),
    criteria
  );
  const yieldRange = evaluateYieldRangePercentile(priceBars, merged, currentPrice);
  const financialHealth = evaluateFinancialHealth(latestFinancial?.equityRatio, latestFinancial?.debtToEquity, criteria);
  const valuation = evaluateValuation(currentPrice, latestFinancial?.eps, criteria);
  const cash = evaluateCash(latestFinancial?.cashAndEquivalents, num(stock.marketCap), criteria);

  const passed = passesCriteria(
    {
      dividendYieldPass: dividendYield.pass,
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
    valuation,
    cash,
    yieldPercentile: yieldRange.percentileInRange,
  });

  const breakdown: RuleBreakdown = {
    dividendYield,
    dividendCutFree: {
      years: cutResult.cutFreeYears,
      pass: cutResult.cutFreeYears >= criteria.minDividendCutFreeYears,
    },
    financialHealth,
    epsTrend: { ...epsTrend, pass: epsTrend.score >= criteria.minEpsTrendScore },
    valuation,
    cash,
    yieldRange,
    priceChangeOverHorizon: priceChangeOverMonths(priceBars, criteria.evaluationHorizonMonths, currentPrice),
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

/**
 * 直近の refresh で保存したスクリーニング結果を読む。
 * computeScreeningFromDb は全銘柄を再計算するため数千銘柄では数十秒かかる。
 * 画面表示など「最新の保存結果で十分」な用途はこちらを使う。
 */
export async function loadLatestScreeningResults(): Promise<StockScreeningResult[]> {
  const run = await prisma.screeningRun.findFirst({ orderBy: { runAt: "desc" }, select: { id: true } });
  if (!run) return [];

  const rows = await prisma.screeningResult.findMany({
    where: { screeningRunId: run.id },
    include: { stock: { select: { name: true, sector33: true, currentPrice: true } } },
  });

  return rows
    .filter((r) => r.ruleBreakdown)
    .map((r) => ({
      code: r.stockCode,
      name: r.stock.name,
      sector: r.stock.sector33 ?? undefined,
      currentPrice: r.stock.currentPrice ? Number(r.stock.currentPrice) : null,
      breakdown: JSON.parse(r.ruleBreakdown!) as RuleBreakdown,
      passedAllRules: r.passedAllRules,
      compositeScore: r.compositeScore ? Number(r.compositeScore) : 0,
      rank: r.rank,
    }))
    // SQLiteはNULLを先頭に並べるため、順位付きを先頭にする並べ替えはJS側で行う
    .sort((a, b) => {
      if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
      if (a.rank !== null) return -1;
      if (b.rank !== null) return 1;
      return b.compositeScore - a.compositeScore;
    });
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
      per: r.breakdown.valuation.per,
      cashToMarketCap: r.breakdown.cash.cashToMarketCap,
      yieldRangePercentile: r.breakdown.yieldRange.percentileInRange,
      passedAllRules: r.passedAllRules,
      compositeScore: r.compositeScore,
      rank: r.rank,
      ruleBreakdown: JSON.stringify(r.breakdown),
    })),
  });

  return results;
}
