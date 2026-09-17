// J-Quants API v2 クライアント (https://jpx-jquants.com/)
//
// 認証: ダッシュボードで発行した APIキー を `x-api-key` ヘッダーに指定する。
// ベースURL: https://api.jquants.com/v2
//
// 注意: Freeプランには /fins/summary (財務情報) が含まれない。
// EPS推移・配当履歴によるスクリーニングを行うには Standard 以上のプラン契約が必要。
// DocType (開示書類種別) の実際の値や pagination の挙動は、実際のAPIキーでの
// レスポンスを見ながら調整が必要な箇所がある (公開ドキュメントの記載が限定的なため)。

import type {
  DataProvider,
  FinancialYearRecord,
  PriceBar,
  StockMasterRecord,
} from "./types";

const BASE_URL = "https://api.jquants.com/v2";

class JQuantsClient {
  constructor(private readonly apiKey: string) {}

  private async request<T = unknown>(
    path: string,
    params: Record<string, string | undefined> = {}
  ): Promise<T> {
    const url = new URL(BASE_URL + path);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }

    const res = await fetch(url.toString(), {
      headers: { "x-api-key": this.apiKey },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `J-Quants API error ${res.status} on ${path}: ${body.slice(0, 300)}`
      );
    }

    return res.json() as Promise<T>;
  }

  /** pagination_key を辿って全ページ取得する共通ヘルパー */
  private async requestAllPages<T>(
    path: string,
    params: Record<string, string | undefined>,
    dataKey: string
  ): Promise<T[]> {
    const all: T[] = [];
    let paginationKey: string | undefined;

    do {
      const page = await this.request<Record<string, unknown>>(path, {
        ...params,
        pagination_key: paginationKey,
      });
      const items = (page[dataKey] as T[] | undefined) ?? [];
      all.push(...items);
      paginationKey = page.pagination_key as string | undefined;
    } while (paginationKey);

    return all;
  }

  async fetchMaster(date?: string): Promise<StockMasterRecord[]> {
    const raw = await this.requestAllPages<Record<string, unknown>>(
      "/equities/master",
      { date },
      "equities_master"
    );

    return raw.map((r) => ({
      code: String(r.Code),
      name: String(r.CoName ?? ""),
      nameEnglish: r.CoNameEn ? String(r.CoNameEn) : undefined,
      market: r.MktNm ? String(r.MktNm) : undefined,
      sector33: r.S33Nm ? String(r.S33Nm) : undefined,
      sector17: r.S17Nm ? String(r.S17Nm) : undefined,
    }));
  }

  async fetchDailyBars(code: string, from?: string, to?: string): Promise<PriceBar[]> {
    const raw = await this.requestAllPages<Record<string, unknown>>(
      "/equities/bars/daily",
      { code, from, to },
      "equities_bars_daily"
    );

    return raw
      .map((r) => ({
        date: String(r.Date),
        open: Number(r.AdjO ?? r.O),
        high: Number(r.AdjH ?? r.H),
        low: Number(r.AdjL ?? r.L),
        close: Number(r.AdjC ?? r.C),
        volume: Number(r.AdjVo ?? r.Vo ?? 0),
      }))
      .filter((b) => Number.isFinite(b.close));
  }

  async fetchFinsSummary(code: string): Promise<FinancialYearRecord[]> {
    const raw = await this.requestAllPages<Record<string, unknown>>(
      "/fins/summary",
      { code },
      "fins_summary"
    );

    // 本決算(通期)のみを年度単位でまとめる。四半期開示は現状のスクリーニングでは使わない。
    const byYear = new Map<number, Record<string, unknown>>();
    for (const r of raw) {
      const discDate = String(r.DiscDate ?? "");
      const year = Number(discDate.slice(0, 4));
      if (!year) continue;
      // 同一年度で複数の開示があれば最新の開示日のものを採用する
      const existing = byYear.get(year);
      if (!existing || String(existing.DiscDate) < discDate) {
        byYear.set(year, r);
      }
    }

    return Array.from(byYear.entries())
      .sort(([a], [b]) => a - b)
      .map(([fiscalYear, r]) => ({
        fiscalYear,
        fiscalPeriodEndDate: String(r.DiscDate),
        eps: numOrUndefined(r.EPS),
        bps: numOrUndefined(r.BPS),
        netSales: numOrUndefined(r.Sales),
        operatingProfit: numOrUndefined(r.OP),
        ordinaryProfit: numOrUndefined(r.OdP),
        netIncome: numOrUndefined(r.NP),
        totalAssets: numOrUndefined(r.TA),
        netAssets: numOrUndefined(r.Eq),
        equityRatio: numOrUndefined(r.EqAR),
        dividendPerShare: numOrUndefined(r.DivAnn),
        isForecast: false,
      }));
  }
}

function numOrUndefined(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export class JQuantsProvider implements DataProvider {
  readonly name = "jquants";
  private client: JQuantsClient;

  constructor(apiKey: string) {
    this.client = new JQuantsClient(apiKey);
  }

  fetchAllStockMaster(): Promise<StockMasterRecord[]> {
    return this.client.fetchMaster();
  }

  fetchPriceHistory(code: string, fromDate?: string): Promise<PriceBar[]> {
    return this.client.fetchDailyBars(code, fromDate);
  }

  fetchFinancialHistory(code: string): Promise<FinancialYearRecord[]> {
    return this.client.fetchFinsSummary(code);
  }
}

export function isJQuantsConfigured(): boolean {
  return Boolean(process.env.JQUANTS_API_KEY);
}

export function createJQuantsProviderFromEnv(): JQuantsProvider | null {
  const key = process.env.JQUANTS_API_KEY;
  if (!key) return null;
  return new JQuantsProvider(key);
}
