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

  // --- 業績モメンタム: 「増収増益が基本」 ---
  // 直近の決算(四半期)と通期の前年比で、減収・減益をマイナス評価する。
  // 通期の減益はいちばん重く見る (増配の原資が細るため)。
  minEarningsMomentumScore: number; // 0-100 - この点数を下回る(=減収減益が大きい)と足切り
  severeAnnualProfitDropPercent: number; // % - 通期の減益がこの幅を超えたら「大きなマイナス」とみなす

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

  minEarningsMomentumScore: 40,
  severeAnnualProfitDropPercent: 20,

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

/** 1期分の業績 (売上と純利益の前年同期比) */
export interface PeriodPerformance {
  label: string; // 「2026年6月期(四半期)」など、人が読める期間名
  endDate: string; // YYYY-MM-DD
  revenue: number | null;
  profit: number | null; // 純利益
  revenueYoYPercent: number | null;
  profitYoYPercent: number | null;
  isIncreasingRevenue: boolean | null;
  isIncreasingProfit: boolean | null;
}

/**
 * 業績モメンタムの判定。「増収増益が基本」という方針を点数にする。
 * 直近の決算(四半期)と通期のそれぞれで減収・減益に減点し、通期の減益をいちばん重くする。
 */
export interface EarningsMomentumCheck {
  latestQuarter: PeriodPerformance | null;
  annual: PeriodPerformance | null;
  /** 直近決算・通期ともに増収増益か */
  isGrowingBoth: boolean;
  /** 通期で増収増益が何年連続しているか (直近年度からさかのぼって数える) */
  consecutiveGrowthYears: number;
  /** 増収だけの連続年数 */
  consecutiveRevenueGrowthYears: number;
  /** 増益だけの連続年数 */
  consecutiveProfitGrowthYears: number;
  /**
   * 前年比を計算できた年数 (データソースの保有年数 - 1)。
   * Yahoo Financeは通期4年分しか返さないため、今は最大3。日々の更新で少しずつ伸びる。
   */
  comparableYears: number;
  /**
   * 通期データを判定に使えないときの理由。
   * 持株会社などは提供元の通期が親会社単体(売上がほぼ受取配当)で四半期の連結と基準が合わないため、
   * そのまま前年比を取ると実態とかけ離れた増収率が出てしまう。検出したら通期は判定から外す。
   */
  annualDataIssue: string | null;
  /** 通期の減益が severeAnnualProfitDropPercent を超えた (AIに原因を調べさせる対象) */
  hasSevereAnnualDrop: boolean;
  /** 減点の理由。UIとAIへの入力にそのまま使う */
  negatives: string[];
  score: number; // 0-100。増収増益で満点
  pass: boolean;
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
  earningsMomentum: EarningsMomentumCheck;
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
