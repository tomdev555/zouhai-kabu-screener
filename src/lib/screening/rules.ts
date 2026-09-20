// 増配株スクリーニングの個別ルール評価ロジック。
// LINEでの選定手順(EPS右肩上がりチェック・減配履歴チェック・負債チェック・
// 特別配当の除外・配当利回りの3年レンジ確認)をコード化したもの。

import type { FinancialYearRecord, PriceBar } from "../data-sources/types";
import type {
  CashCheck,
  DividendCutResult,
  DividendYieldCheck,
  EpsTrendResult,
  FinancialHealthCheck,
  ScreeningCriteria,
  ValuationCheck,
  YieldRangeResult,
} from "./types";

/** 前後の年と比べて配当が大きく跳ねている年を「特別配当」として検出する */
export function detectSpecialDividendYears(
  financials: FinancialYearRecord[],
  spikeRatio: number
): Set<number> {
  const special = new Set<number>();
  const sorted = [...financials].sort((a, b) => a.fiscalYear - b.fiscalYear);

  for (let i = 1; i < sorted.length - 1; i++) {
    const prev = sorted[i - 1].dividendPerShare;
    const curr = sorted[i].dividendPerShare;
    const next = sorted[i + 1].dividendPerShare;
    if (prev === undefined || curr === undefined || next === undefined) continue;
    const neighborAvg = (prev + next) / 2;
    if (neighborAvg > 0 && curr > neighborAvg * spikeRatio) {
      special.add(sorted[i].fiscalYear);
    }
  }
  return special;
}

/** 特別配当年を近傍年で補正した「通常配当」系列を作り、減配せず経過した年数を数える */
export function evaluateDividendCutFreeYears(
  financials: FinancialYearRecord[],
  spikeRatio: number
): DividendCutResult {
  const sorted = [...financials].sort((a, b) => a.fiscalYear - b.fiscalYear);
  const specialYears = detectSpecialDividendYears(sorted, spikeRatio);

  const normalizedSeries = sorted.map((f, i) => {
    let dps = f.dividendPerShare ?? 0;
    if (specialYears.has(f.fiscalYear)) {
      const prev = sorted[i - 1]?.dividendPerShare;
      const next = sorted[i + 1]?.dividendPerShare;
      if (prev !== undefined && next !== undefined) dps = (prev + next) / 2;
      else if (prev !== undefined) dps = prev;
      else if (next !== undefined) dps = next;
    }
    return { fiscalYear: f.fiscalYear, dividendPerShare: dps, wasSpecial: specialYears.has(f.fiscalYear) };
  });

  // 直近の年から遡って、前年以上(減配していない)を数える
  let cutFreeYears = 0;
  let hadAnyCut = false;
  for (let i = normalizedSeries.length - 1; i > 0; i--) {
    const curr = normalizedSeries[i].dividendPerShare;
    const prev = normalizedSeries[i - 1].dividendPerShare;
    // わずかな丸め誤差を許容 (0.5%までの低下は「実質維持」とみなす)
    if (curr >= prev * 0.995) {
      cutFreeYears++;
    } else {
      hadAnyCut = true;
      break;
    }
  }
  // データが有る限りは経過年数としてカウント(最大でヒストリー年数-1)
  if (!hadAnyCut) cutFreeYears = normalizedSeries.length - 1;

  return { cutFreeYears, hadAnyCut, normalizedSeries };
}

/** EPSの推移が右肩上がりかどうかを線形回帰の傾きから0-100のスコアに変換する */
export function evaluateEpsTrend(financials: FinancialYearRecord[]): EpsTrendResult {
  const sorted = [...financials]
    .sort((a, b) => a.fiscalYear - b.fiscalYear)
    .filter((f) => typeof f.eps === "number" && f.eps! > 0);

  if (sorted.length < 3) {
    return { cagrPercent: null, downYears: 0, yearsUsed: sorted.length, score: 0 };
  }

  const first = sorted[0].eps!;
  const last = sorted[sorted.length - 1].eps!;
  const years = sorted.length - 1;
  const cagr = (Math.pow(last / first, 1 / years) - 1) * 100;

  let downYears = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].eps! < sorted[i - 1].eps!) downYears++;
  }

  // CAGRを0-100にマッピング(0%成長=50点、10%成長=90点前後)し、down年数分減点する
  const cagrScore = clamp(50 + cagr * 4, 0, 100);
  const downYearPenalty = downYears * 12;
  const score = clamp(cagrScore - downYearPenalty, 0, 100);

  return { cagrPercent: round2(cagr), downYears, yearsUsed: sorted.length, score: round2(score) };
}

/** 直近3年の「配当/年末終値」利回りレンジの中で、現在の利回りがどの位置にあるか */
export function evaluateYieldRangePercentile(
  priceHistory: PriceBar[],
  financials: FinancialYearRecord[],
  currentPrice: number | null
): YieldRangeResult {
  const sortedFin = [...financials].sort((a, b) => a.fiscalYear - b.fiscalYear);
  const last3 = sortedFin.slice(-3);
  if (last3.length === 0 || !currentPrice) {
    return { currentYield: null, minYield3y: null, maxYield3y: null, percentileInRange: null };
  }

  const yields: number[] = [];
  for (const f of last3) {
    if (!f.dividendPerShare) continue;
    const yearEnd = priceHistory
      .filter((p) => p.date.startsWith(String(f.fiscalYear)))
      .sort((a, b) => a.date.localeCompare(b.date))
      .pop();
    const price = yearEnd?.close;
    if (price) yields.push((f.dividendPerShare / price) * 100);
  }

  const latestDividend = last3[last3.length - 1]?.dividendPerShare;
  const currentYield = latestDividend ? (latestDividend / currentPrice) * 100 : null;

  if (yields.length === 0 || currentYield === null) {
    return { currentYield, minYield3y: null, maxYield3y: null, percentileInRange: null };
  }

  const minY = Math.min(...yields);
  const maxY = Math.max(...yields);
  const percentile =
    maxY === minY ? 50 : clamp(((currentYield - minY) / (maxY - minY)) * 100, 0, 100);

  return {
    currentYield: round2(currentYield),
    minYield3y: round2(minY),
    maxYield3y: round2(maxY),
    percentileInRange: round2(percentile),
  };
}

export function evaluateDividendYield(
  currentPrice: number | null,
  latestAnnualDividend: number | null | undefined
): number | null {
  if (!currentPrice || !latestAnnualDividend) return null;
  return round2((latestAnnualDividend / currentPrice) * 100);
}

/**
 * 「負債が大きくないか」のチェック。
 * 自己資本比率が取れるデータソース(J-Quants等)ではそれを使い、
 * 取れない場合(Yahoo Finance)はD/E比率で代替する。
 */
export function evaluateFinancialHealth(
  equityRatio: number | null | undefined,
  debtToEquity: number | null | undefined,
  criteria: ScreeningCriteria
): FinancialHealthCheck {
  if (equityRatio !== null && equityRatio !== undefined) {
    return {
      metric: "equityRatio",
      value: round2(equityRatio),
      pass: equityRatio >= criteria.minEquityRatio,
    };
  }
  if (debtToEquity !== null && debtToEquity !== undefined) {
    return {
      metric: "debtToEquity",
      value: round2(debtToEquity),
      pass: debtToEquity <= criteria.maxDebtToEquity,
    };
  }
  return { metric: "none", value: null, pass: false };
}

/**
 * 配当利回りの判定。「4%前後がベスト、高すぎても低すぎてもよくない」を
 * 目標値で満点・離れるほど減点する山型スコアにする。
 * 半年程度の投資視野では「これから受け取る配当」が重要なので、会社予想(今期)の配当があればそちらを使う。
 */
export function evaluateDividendYieldCheck(
  currentPrice: number | null,
  trailingDividend: number | null | undefined,
  forwardDividend: number | null | undefined,
  criteria: ScreeningCriteria
): DividendYieldCheck {
  const useForward = criteria.preferForwardDividend && forwardDividend !== null && forwardDividend !== undefined && forwardDividend > 0;
  const dps = useForward ? forwardDividend! : trailingDividend ?? null;
  const value = evaluateDividendYield(currentPrice, dps);
  if (value === null) {
    return { value: null, basis: "none", dividendPerShare: null, score: 0, pass: false };
  }
  const distance = Math.abs(value - criteria.targetDividendYield);
  const score = clamp(100 * (1 - distance / criteria.dividendYieldTolerance), 0, 100);
  return {
    value,
    basis: useForward ? "forward" : "trailing",
    dividendPerShare: round2(dps!),
    score: round2(score),
    pass: value >= criteria.minDividendYield && value <= criteria.maxDividendYield,
  };
}

/**
 * PERの評価。basePer を基準点(70点)とし、1倍安いごとに+5点(上限100)、1倍割高なごとに-5点(下限0)。
 * 赤字(EPS<=0)は0点。足切りには使わず、スコアにのみ反映する。
 */
export function evaluateValuation(
  currentPrice: number | null,
  latestEps: number | null | undefined,
  criteria: ScreeningCriteria
): ValuationCheck {
  if (!currentPrice || !latestEps || latestEps <= 0) return { per: null, score: 0 };
  const per = round2(currentPrice / latestEps);
  const score = clamp(70 + (criteria.basePer - per) * 5, 0, 100);
  return { per, score: round2(score) };
}

/** 現金確保の評価。現預金÷時価総額が cashRatioFullScore(%) 以上で満点、0で0点の線形。 */
export function evaluateCash(
  cash: number | null | undefined,
  marketCap: number | null | undefined,
  criteria: ScreeningCriteria
): CashCheck {
  if (cash === null || cash === undefined || !marketCap) {
    return { cash: cash ?? null, marketCap: marketCap ?? null, cashToMarketCap: null, score: 0 };
  }
  const ratio = (cash / marketCap) * 100;
  return {
    cash,
    marketCap,
    cashToMarketCap: round2(ratio),
    score: round2(clamp((ratio / criteria.cashRatioFullScore) * 100, 0, 100)),
  };
}

export function passesCriteria(
  values: {
    dividendYieldPass: boolean;
    cutFreeYears: number;
    financialHealthPass: boolean;
    epsScore: number;
  },
  criteria: ScreeningCriteria
): boolean {
  if (!values.dividendYieldPass) return false;
  if (values.cutFreeYears < criteria.minDividendCutFreeYears) return false;
  if (!values.financialHealthPass) return false;
  if (values.epsScore < criteria.minEpsTrendScore) return false;
  return true;
}

export function compositeScore(values: {
  dividendYield: DividendYieldCheck;
  cutFreeYears: number;
  financialHealth: FinancialHealthCheck;
  epsScore: number;
  valuation: ValuationCheck;
  cash: CashCheck;
  yieldPercentile: number | null;
}): number {
  const cutScore = clamp((values.cutFreeYears / 15) * 100, 0, 100);
  const healthScore = financialHealthScore(values.financialHealth);
  const rangeScore = values.yieldPercentile ?? 50;

  // 重み付け: 減配なし年数・EPS成長性を軸に、利回り(4%目標)・PER(15倍基準)・現金確保を加える
  return round2(
    values.epsScore * 0.2 +
      cutScore * 0.25 +
      healthScore * 0.15 +
      values.dividendYield.score * 0.15 +
      values.valuation.score * 0.1 +
      values.cash.score * 0.1 +
      rangeScore * 0.05
  );
}

/** 財務健全性を0-100のスコアに正規化する (自己資本比率は高いほど、D/E比率は低いほど高得点) */
function financialHealthScore(health: FinancialHealthCheck): number {
  if (health.value === null) return 0;
  if (health.metric === "equityRatio") return clamp((health.value / 60) * 100, 0, 100);
  return clamp(100 - (health.value / 200) * 100, 0, 100);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
