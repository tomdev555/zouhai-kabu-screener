// Yahoo Finance の非公式JSONエンドポイントから、日本株の株価・配当履歴・財務指標を取得する。
// APIキーや利用登録は不要 (Pythonのyfinanceライブラリが使っているのと同じ方式)。
//
// 注意: 公式に提供されているAPIではないため、Yahoo側の仕様変更で動かなくなる可能性がある。
// 安定性・正確性を重視する場合は J-Quants API (有料プラン) に切り替えること
// (JQUANTS_API_KEY を設定すればそちらが優先される)。
//
// 日本株のティッカーは「証券コード + .T」形式 (例: 7203 -> 7203.T)。

const CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const QUOTE_SUMMARY_BASE = "https://query1.finance.yahoo.com/v10/finance/quoteSummary";
const CRUMB_URL = "https://query1.finance.yahoo.com/v1/test/getcrumb";
const COOKIE_URL = "https://fc.yahoo.com/";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function toYahooSymbol(code: string): string {
  return `${code}.T`;
}

// quoteSummary の利用には cookie + crumb の組み合わせが必要。プロセス内で使い回す。
let cachedAuth: { cookie: string; crumb: string } | null = null;

async function getAuth(): Promise<{ cookie: string; crumb: string }> {
  if (cachedAuth) return cachedAuth;

  const cookieRes = await fetch(COOKIE_URL, { headers: { "User-Agent": USER_AGENT } });
  const setCookie = cookieRes.headers.getSetCookie?.() ?? [];
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");

  const crumbRes = await fetch(CRUMB_URL, {
    headers: { "User-Agent": USER_AGENT, Cookie: cookie },
  });
  const crumb = (await crumbRes.text()).trim();

  if (!crumb || crumb.includes("<")) {
    throw new Error("Yahoo Finance の crumb 取得に失敗しました");
  }

  cachedAuth = { cookie, crumb };
  return cachedAuth;
}

export interface YahooDividendEvent {
  date: string; // YYYY-MM-DD (権利落ち日)
  amount: number;
}

export interface YahooChartResult {
  currency: string | null;
  longName: string | null;
  currentPrice: number | null;
  bars: { date: string; open: number; high: number; low: number; close: number; volume: number }[];
  dividends: YahooDividendEvent[];
}

interface RawChartResponse {
  chart: {
    result?: {
      meta: Record<string, unknown>;
      timestamp?: number[];
      indicators: { quote: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }[] };
      events?: { dividends?: Record<string, { amount: number; date: number }> };
    }[];
    error?: { code: string; description: string } | null;
  };
}

/**
 * 株価と配当履歴をまとめて取得する。
 * interval="1d" は日足(チャート用)、"1mo" は月足(長期の配当履歴だけが必要な場合に軽量)。
 */
export async function fetchChart(
  code: string,
  range = "10y",
  interval: "1d" | "1wk" | "1mo" = "1d"
): Promise<YahooChartResult | null> {
  const url = new URL(`${CHART_BASE}/${toYahooSymbol(code)}`);
  url.searchParams.set("range", range);
  url.searchParams.set("interval", interval);
  url.searchParams.set("events", "div");

  const res = await fetch(url.toString(), { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    if (res.status === 404) return null; // 存在しない/上場廃止のティッカー
    throw new Error(`Yahoo Finance chart error ${res.status} for ${code}`);
  }

  const json = (await res.json()) as RawChartResponse;
  const result = json.chart.result?.[0];
  if (!result) return null;

  const quote = result.indicators.quote[0] ?? {};
  const timestamps = result.timestamp ?? [];

  const bars: YahooChartResult["bars"] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = quote.close?.[i];
    if (close === null || close === undefined) continue;
    bars.push({
      date: toDateString(timestamps[i]),
      open: quote.open?.[i] ?? close,
      high: quote.high?.[i] ?? close,
      low: quote.low?.[i] ?? close,
      close,
      volume: quote.volume?.[i] ?? 0,
    });
  }

  const dividends = Object.values(result.events?.dividends ?? {})
    .map((d) => ({ date: toDateString(d.date), amount: d.amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    currency: (result.meta.currency as string) ?? null,
    longName: (result.meta.longName as string) ?? null,
    currentPrice: (result.meta.regularMarketPrice as number) ?? bars[bars.length - 1]?.close ?? null,
    bars,
    dividends,
  };
}

export interface YahooFundamentals {
  trailingEps: number | null;
  bookValuePerShare: number | null;
  debtToEquity: number | null; // % 表記 (例: 114.97 は 負債が自己資本の1.15倍)
  returnOnEquity: number | null;
  fiscalYearEnd: string | null; // YYYY-MM-DD
  annualNetIncome: { endDate: string; netIncome: number }[];
}

interface RawValue {
  raw?: number;
  fmt?: string;
}

/** EPS・BPS・D/E比率など、chartエンドポイントでは取れない財務指標を取得する */
export async function fetchFundamentals(code: string): Promise<YahooFundamentals | null> {
  const { cookie, crumb } = await getAuth();

  const url = new URL(`${QUOTE_SUMMARY_BASE}/${toYahooSymbol(code)}`);
  url.searchParams.set("modules", "defaultKeyStatistics,financialData,incomeStatementHistory");
  url.searchParams.set("crumb", crumb);

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, Cookie: cookie },
  });

  if (res.status === 401) {
    // crumbが失効した場合は1度だけ取り直す
    cachedAuth = null;
    const retryAuth = await getAuth();
    url.searchParams.set("crumb", retryAuth.crumb);
    const retry = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT, Cookie: retryAuth.cookie },
    });
    if (!retry.ok) return null;
    return parseFundamentals(await retry.json());
  }

  if (!res.ok) return null;
  return parseFundamentals(await res.json());
}

function parseFundamentals(json: unknown): YahooFundamentals | null {
  const result = (json as { quoteSummary?: { result?: Record<string, unknown>[] } }).quoteSummary?.result?.[0];
  if (!result) return null;

  const ks = (result.defaultKeyStatistics ?? {}) as Record<string, RawValue | undefined>;
  const fd = (result.financialData ?? {}) as Record<string, RawValue | undefined>;
  const ish = (result.incomeStatementHistory ?? {}) as {
    incomeStatementHistory?: { endDate?: RawValue & { fmt?: string }; netIncome?: RawValue }[];
  };

  // 無借金企業は debtToEquity が空で返ってくるため、有利子負債0を確認できる場合は0とみなす。
  // (そうしないと最も財務の健全な企業が「判定不能」で除外されてしまう)
  const debtToEquity =
    fd.debtToEquity?.raw ?? (fd.totalDebt?.raw === 0 ? 0 : null);

  return {
    trailingEps: ks.trailingEps?.raw ?? null,
    bookValuePerShare: ks.bookValue?.raw ?? null,
    debtToEquity,
    returnOnEquity: fd.returnOnEquity?.raw ?? null,
    fiscalYearEnd: ks.lastFiscalYearEnd?.fmt ?? null,
    annualNetIncome: (ish.incomeStatementHistory ?? [])
      .map((s) => ({ endDate: s.endDate?.fmt ?? "", netIncome: s.netIncome?.raw ?? NaN }))
      .filter((s) => s.endDate && Number.isFinite(s.netIncome)),
  };
}

function toDateString(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}
