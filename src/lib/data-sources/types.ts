// データソース(J-Quants本番 / モック)を差し替え可能にするための共通インターフェース。
// 実際のJ-Quants APIキーが未設定の場合は mock-provider.ts が使われる。

export interface StockMasterRecord {
  code: string;
  name: string;
  nameEnglish?: string;
  market?: string;
  sector33?: string;
  sector17?: string;
  currentPrice?: number;
  per?: number;
  pbr?: number;
  marketCap?: number;
}

export interface PriceBar {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FinancialYearRecord {
  fiscalYear: number;
  fiscalPeriodEndDate: string; // YYYY-MM-DD
  eps?: number;
  bps?: number;
  netSales?: number;
  operatingProfit?: number;
  ordinaryProfit?: number;
  netIncome?: number;
  totalAssets?: number;
  netAssets?: number;
  equityRatio?: number; // %
  debtToEquity?: number; // % (有利子負債 ÷ 自己資本。自己資本比率が取れないデータソース用の代替指標)
  interestBearingDebt?: number;
  cashAndEquivalents?: number; // 現金及び現金同等物 (円)
  dividendPerShare?: number; // 年間合計 (中間+期末など)
  isForecast?: boolean;
  // 以下は最新年度のレコードにだけ付く「現在のスナップショット」。refresh 時に Stock 側へ転記する
  forwardDividendPerShare?: number; // 会社予想ベースの今期年間配当 (円)
  marketCap?: number; // 時価総額 (円)
}

/**
 * 決算短信ベースの四半期(会社によっては半期)業績。
 * 「増収増益が基本」の判定で、直近決算の前年同期比を見るために使う。
 */
export interface QuarterlyResultRecord {
  endDate: string; // YYYY-MM-DD (決算期末)
  revenue?: number; // 売上高 (円)
  profit?: number; // 純利益 (円)
}

export interface QuarterlyResults {
  records: QuarterlyResultRecord[];
  /**
   * データソースが算出済みの直近決算の前年同期比 (%)。
   * 四半期開示の会社は手元の4期分では前年同期が揃わないため、その場合に使う。
   */
  reportedRevenueYoYPercent?: number | null;
  reportedProfitYoYPercent?: number | null;
}

export interface DataProvider {
  readonly name: string;
  fetchAllStockMaster(): Promise<StockMasterRecord[]>;
  fetchPriceHistory(code: string, fromDate?: string): Promise<PriceBar[]>;
  fetchFinancialHistory(code: string): Promise<FinancialYearRecord[]>;
  /** 四半期決算。取得できないデータソースは空配列を返す */
  fetchQuarterlyResults?(code: string): Promise<QuarterlyResults>;
}
