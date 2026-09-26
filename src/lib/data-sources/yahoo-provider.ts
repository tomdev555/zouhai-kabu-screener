// JPXの公開銘柄一覧 + Yahoo Finance を組み合わせた、APIキー不要のデータプロバイダ。
// JQUANTS_API_KEY が未設定の場合、これがデフォルトのデータソースになる。

import { fetchJpxListedStocks } from "./jpx-listing";
import { fetchChart, fetchFundamentals } from "./yahoo-finance";
import type {
  DataProvider,
  FinancialYearRecord,
  PriceBar,
  QuarterlyResults,
  StockMasterRecord,
} from "./types";

// fetchFinancialHistory と fetchQuarterlyResults は同じ quoteSummary レスポンスを使うため、
// 銘柄ごとに1回だけ取得して使い回す (全銘柄でリクエストが倍にならないようにする)。
type Fundamentals = Awaited<ReturnType<typeof fetchFundamentals>>;
const fundamentalsCache = new Map<string, Promise<Fundamentals>>();

function getFundamentals(code: string): Promise<Fundamentals> {
  const cached = fundamentalsCache.get(code);
  if (cached) return cached;
  const p = fetchFundamentals(code).catch(() => null);
  // 並列数ぶんの銘柄を保持できれば十分なので、増えすぎたら古いものから捨てる
  if (fundamentalsCache.size > 64) {
    const oldest = fundamentalsCache.keys().next().value;
    if (oldest !== undefined) fundamentalsCache.delete(oldest);
  }
  fundamentalsCache.set(code, p);
  return p;
}

// 対象銘柄数を絞りたい場合に使う (未設定なら全銘柄)。初回の動作確認用。
function universeLimit(): number | null {
  const raw = process.env.UNIVERSE_LIMIT;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

// 市場区分を絞る (例: "プライム")。未設定なら全市場。
function marketFilter(): string | null {
  return process.env.UNIVERSE_MARKET?.trim() || null;
}

export class YahooFinanceProvider implements DataProvider {
  readonly name = "yahoo+jpx";

  async fetchAllStockMaster(): Promise<StockMasterRecord[]> {
    const stocks = await fetchJpxListedStocks();

    const market = marketFilter();
    const filtered = market ? stocks.filter((s) => s.market.includes(market)) : stocks;

    const limit = universeLimit();
    return limit ? filtered.slice(0, limit) : filtered;
  }

  async fetchPriceHistory(code: string): Promise<PriceBar[]> {
    // 日足は全銘柄分をDBに保存するとかなりの量になるため、既定は5年分。
    // チャート表示と「直近3年の配当利回りレンジ」の算出にはこれで足りる。
    const range = process.env.PRICE_HISTORY_RANGE || "5y";
    const chart = await fetchChart(code, range, "1d");
    return chart?.bars ?? [];
  }

  async fetchFinancialHistory(code: string): Promise<FinancialYearRecord[]> {
    // 配当履歴(権利落ち日ベース)と財務指標を取得して、年度単位のレコードに組み立てる。
    // 「10年以上減配なし」の判定には11年分以上の配当履歴が必要なため、
    // 配当は取得可能な全期間(range=max、20年以上遡れることが多い)を取る。
    const [chart, fundamentals] = await Promise.all([
      fetchChart(code, "max", "1mo"),
      getFundamentals(code),
    ]);
    if (!chart) return [];

    const fiscalYearEndMonth = parseFiscalYearEndMonth(fundamentals?.fiscalYearEnd) ?? 3;
    const dividendByYear = aggregateDividendsByFiscalYear(chart.dividends, fiscalYearEndMonth);
    const epsByYear = estimateEpsByFiscalYear(fundamentals, fiscalYearEndMonth);
    // 「増収増益が基本」の判定に使う通期の売上・純利益 (直近4年分)
    const resultsByYear = new Map<number, { revenue: number | null; netIncome: number | null }>();
    for (const r of fundamentals?.annualResults ?? []) {
      resultsByYear.set(toFiscalYear(r.endDate, fiscalYearEndMonth), {
        revenue: r.revenue,
        netIncome: r.netIncome,
      });
    }

    const years = new Set<number>([...dividendByYear.keys(), ...epsByYear.keys()]);
    const latestYear = Math.max(...years, 0);

    return Array.from(years)
      .sort((a, b) => a - b)
      .map((fiscalYear) => ({
        fiscalYear,
        fiscalPeriodEndDate: formatFiscalPeriodEnd(fiscalYear, fiscalYearEndMonth),
        eps: epsByYear.get(fiscalYear),
        netSales: resultsByYear.get(fiscalYear)?.revenue ?? undefined,
        netIncome: resultsByYear.get(fiscalYear)?.netIncome ?? undefined,
        bps: fiscalYear === latestYear ? fundamentals?.bookValuePerShare ?? undefined : undefined,
        // Yahoo Financeからは自己資本比率が取れないため、D/E比率を負債の指標として使う
        debtToEquity: fiscalYear === latestYear ? fundamentals?.debtToEquity ?? undefined : undefined,
        cashAndEquivalents: fiscalYear === latestYear ? fundamentals?.totalCash ?? undefined : undefined,
        dividendPerShare: dividendByYear.get(fiscalYear),
        isForecast: false,
        forwardDividendPerShare: fiscalYear === latestYear ? fundamentals?.forwardDividendRate ?? undefined : undefined,
        marketCap: fiscalYear === latestYear ? fundamentals?.marketCap ?? undefined : undefined,
      }));
  }

  async fetchQuarterlyResults(code: string): Promise<QuarterlyResults> {
    const fundamentals = await getFundamentals(code);
    const pct = (v: number | null | undefined) =>
      v === null || v === undefined ? null : Math.round(v * 1000) / 10;
    return {
      records: (fundamentals?.quarterlyResults ?? []).map((r) => ({
        endDate: r.endDate,
        revenue: r.revenue ?? undefined,
        profit: r.netIncome ?? undefined,
      })),
      reportedRevenueYoYPercent: pct(fundamentals?.quarterlyRevenueGrowth),
      reportedProfitYoYPercent: pct(fundamentals?.quarterlyEarningsGrowth),
    };
  }
}

/** 決算期末日("2026-03-31")を決算年度に変換する。決算月より後に終わる期は翌年度扱い */
function toFiscalYear(endDate: string, fiscalYearEndMonth: number): number {
  const year = Number(endDate.slice(0, 4));
  const month = Number(endDate.slice(5, 7));
  return month > fiscalYearEndMonth ? year + 1 : year;
}

/** "2026-03-31" -> 3 */
function parseFiscalYearEndMonth(fiscalYearEnd: string | null | undefined): number | null {
  if (!fiscalYearEnd) return null;
  const month = Number(fiscalYearEnd.slice(5, 7));
  return month >= 1 && month <= 12 ? month : null;
}

function formatFiscalPeriodEnd(fiscalYear: number, month: number): string {
  const lastDay = new Date(fiscalYear, month, 0).getDate();
  return `${fiscalYear}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/**
 * 権利落ち日ベースの配当イベント(中間配当・期末配当など年2回程度)を決算年度ごとに合計する。
 * 決算月がM月の場合、M月より後の月の配当は翌年度分として扱う。
 * 例: 3月決算なら 2025年9月(中間) と 2026年3月(期末) が「2026年度」の配当になる。
 */
export function aggregateDividendsByFiscalYear(
  dividends: { date: string; amount: number }[],
  fiscalYearEndMonth: number
): Map<number, number> {
  const byYear = new Map<number, number>();

  for (const d of dividends) {
    const year = Number(d.date.slice(0, 4));
    const month = Number(d.date.slice(5, 7));
    const fiscalYear = month > fiscalYearEndMonth ? year + 1 : year;
    byYear.set(fiscalYear, (byYear.get(fiscalYear) ?? 0) + d.amount);
  }

  // 最も古い年度は期の途中からのデータで配当が欠けている可能性があるため除外する
  const years = Array.from(byYear.keys()).sort((a, b) => a - b);
  if (years.length > 1) byYear.delete(years[0]);

  return byYear;
}

/**
 * Yahoo Financeからは年度別EPSが直接取れないため、
 * 年次純利益(4年分)と現在のEPSから「1株あたり」に換算した近似値を作る。
 * 発行済株式数が期間中ほぼ一定であることを前提とした近似なので、
 * 絶対値ではなく推移(右肩上がりかどうか)の判定に使う。
 */
function estimateEpsByFiscalYear(
  fundamentals: {
    trailingEps: number | null;
    annualNetIncome: { endDate: string; netIncome: number }[];
  } | null,
  fiscalYearEndMonth: number
): Map<number, number> {
  const byYear = new Map<number, number>();
  if (!fundamentals || fundamentals.annualNetIncome.length === 0) return byYear;

  const sorted = [...fundamentals.annualNetIncome].sort((a, b) => a.endDate.localeCompare(b.endDate));
  const latestNetIncome = sorted[sorted.length - 1]?.netIncome;
  const eps = fundamentals.trailingEps;

  if (!latestNetIncome || !eps) return byYear;
  const perShareScale = eps / latestNetIncome;

  for (const row of sorted) {
    const year = Number(row.endDate.slice(0, 4));
    const month = Number(row.endDate.slice(5, 7));
    const fiscalYear = month > fiscalYearEndMonth ? year + 1 : year;
    byYear.set(fiscalYear, round2(row.netIncome * perShareScale));
  }

  return byYear;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
