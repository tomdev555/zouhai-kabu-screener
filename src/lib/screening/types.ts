export interface ScreeningCriteria {
  // --- 配当利回り: 「4%前後がベスト。高すぎても低すぎてもよくない」 ---
  targetDividendYield: number; // % - この値で満点
  dividendYieldTolerance: number; // % - 目標からこの幅だけ離れると0点 (上下対称)
  minDividendYield: number; // % - 合格帯の下限 (低すぎ=買われすぎ)
  maxDividendYield: number; // % - 合格帯の上限 (高すぎ=減配リスクのサイン)
  // 会社予想(今期)の配当があればそれで利回りを計算する。半年程度の投資視野で「これから受け取る配当」を重視するため
  preferForwardDividend: boolean;
  evaluationHorizonMonths: number; // 評価の目安期間。株価騰落率の参考表示に使う

  // --- 減配履歴・EPS ---
  minDividendCutFreeYears: number; // 減配せず経過した年数の最低ライン
  minEpsTrendScore: number; // 0-100 - EPS成長性スコアの最低ライン
  specialDividendSpikeRatio: number; // 前後の年と比べてこの倍率を超えたら特別配当とみなす

  // --- 財務健全性 ---
  minEquityRatio: number; // % - 自己資本比率の最低ライン (負債の目安)
  maxDebtToEquity: number; // % - 自己資本比率が取れないデータソース用。有利子負債÷自己資本の上限

  // --- バリュエーション: 「PERは15倍がベース」 ---
  basePer: number; // この倍率を基準点とし、安ければ加点・割高なら減点 (足切りはしない)

  // --- 現金確保 ---
  cashRatioFullScore: number; // % - 現預金÷時価総額がこの値以上で満点

  targetCount: number; // 最終的に選定する銘柄数
}

export const DEFAULT_CRITERIA: ScreeningCriteria = {
  targetDividendYield: 4.0,
  dividendYieldTolerance: 2.5,
  minDividendYield: 2.5,
  maxDividendYield: 6.0,
  preferForwardDividend: true,
  evaluationHorizonMonths: 6,

  minDividendCutFreeYears: 10,
  minEpsTrendScore: 55,
  specialDividendSpikeRatio: 1.5,

  minEquityRatio: 30,
  maxDebtToEquity: 150,

  basePer: 15,

  cashRatioFullScore: 30,

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

export interface DividendYieldCheck {
  value: number | null; // 判定に使った利回り (%)
  basis: "forward" | "trailing" | "none"; // 会社予想ベースか実績ベースか
  dividendPerShare: number | null; // 判定に使った年間配当 (円)
  score: number; // 0-100。目標利回りで満点
  pass: boolean;
}

export interface ValuationCheck {
  per: number | null;
  score: number; // 0-100。basePer で基準点、安いほど高得点
}

export interface CashCheck {
  cash: number | null; // 現預金 (円)
  marketCap: number | null; // 時価総額 (円)
  cashToMarketCap: number | null; // %
  score: number; // 0-100
}

export interface RuleBreakdown {
  dividendYield: DividendYieldCheck;
  dividendCutFree: { years: number; pass: boolean };
  financialHealth: FinancialHealthCheck;
  epsTrend: EpsTrendResult & { pass: boolean };
  valuation: ValuationCheck;
  cash: CashCheck;
  yieldRange: YieldRangeResult;
  priceChangeOverHorizon: number | null; // 評価期間(既定6ヶ月)の株価騰落率 (%)。参考表示
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
