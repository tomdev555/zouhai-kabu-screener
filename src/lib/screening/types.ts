export interface ScreeningCriteria {
  minDividendYield: number; // % - 低すぎる利回りは既に買われすぎとみなす
  maxDividendYield: number; // % - 逆に極端に高すぎる利回りは減配リスクのサインとみなす
  minDividendCutFreeYears: number; // 減配せず経過した年数の最低ライン
  minEquityRatio: number; // % - 自己資本比率の最低ライン (負債の目安)
  maxDebtToEquity: number; // % - 自己資本比率が取れないデータソース用。有利子負債÷自己資本の上限
  minEpsTrendScore: number; // 0-100 - EPS成長性スコアの最低ライン
  specialDividendSpikeRatio: number; // 前後の年と比べてこの倍率を超えたら特別配当とみなす
  targetCount: number; // 最終的に選定する銘柄数
}

export const DEFAULT_CRITERIA: ScreeningCriteria = {
  minDividendYield: 2.0,
  maxDividendYield: 7.0,
  minDividendCutFreeYears: 10,
  minEquityRatio: 30,
  maxDebtToEquity: 150,
  minEpsTrendScore: 55,
  specialDividendSpikeRatio: 1.5,
  targetCount: 50,
};

export interface EpsTrendResult {
  cagrPercent: number | null;
  downYears: number;
  yearsUsed: number;
  score: number; // 0-100
}

export interface DividendCutResult {
  cutFreeYears: number;
  hadAnyCut: boolean;
  normalizedSeries: { fiscalYear: number; dividendPerShare: number; wasSpecial: boolean }[];
}

export interface YieldRangeResult {
  currentYield: number | null;
  minYield3y: number | null;
  maxYield3y: number | null;
  percentileInRange: number | null; // 0(範囲最安値=割高) - 100(範囲最高値=割安)
}

/** 財務の健全性チェック。データソースによって自己資本比率とD/E比率のどちらかを使う。 */
export interface FinancialHealthCheck {
  metric: "equityRatio" | "debtToEquity" | "none";
  value: number | null;
  pass: boolean;
}

export interface RuleBreakdown {
  dividendYield: { value: number | null; pass: boolean };
  dividendCutFree: { years: number; pass: boolean };
  financialHealth: FinancialHealthCheck;
  epsTrend: EpsTrendResult & { pass: boolean };
  yieldRange: YieldRangeResult;
  specialDividendYears: number[];
}

export interface StockScreeningResult {
  code: string;
  name: string;
  sector?: string;
  currentPrice: number | null;
  breakdown: RuleBreakdown;
  passedAllRules: boolean;
  compositeScore: number;
  rank: number | null;
}
