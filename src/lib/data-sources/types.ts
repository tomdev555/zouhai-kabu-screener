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

export interface DataProvider {
  readonly name: string;
  fetchAllStockMaster(): Promise<StockMasterRecord[]>;
  fetchPriceHistory(code: string, fromDate?: string): Promise<PriceBar[]>;
  fetchFinancialHistory(code: string): Promise<FinancialYearRecord[]>;
}
