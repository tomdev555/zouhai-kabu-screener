// EDINETの有価証券報告書(XBRL/CSV)から、J-Quantsの契約プランでは足りない年数分の
// EPS・1株配当・自己資本比率の長期履歴を補うためのモジュール。
//
// 仕組み:
// 1件の有価証券報告書XBRLには「主要な経営指標等の推移」として当期+過去4期分、
// つまり5年分のデータが1つの書類にまとまって入っている(EDINETの標準的な開示形式)。
// そのため「直近の報告書」と「約5年前の報告書」の2件を組み合わせれば10年分をカバーできる。
//
// 提出書類を銘柄コードで直接検索するAPIはEDINETに存在しないため、
// 日付ごとの提出書類一覧(documents.json)を一定期間スキャンして
// secCode -> 提出書類 のインデックスをローカルに構築してキャッシュする。
// このインデックス構築は低速(1日1リクエスト)なため、日次のrefreshとは別に
// 明示的に実行する(npm run edinet:index)。

import { promises as fs } from "fs";
import path from "path";
import {
  type EdinetCsvRow,
  type EdinetFiling,
  SECURITIES_REPORT_DOC_TYPE_CODE,
  downloadCsvZip,
  extractCsvRows,
  isEdinetConfigured,
  listFilingsForDate,
  tickerToSecCode,
} from "./edinet-client";
import type { FinancialYearRecord } from "./types";

const CACHE_DIR = path.join(process.cwd(), ".cache", "edinet");
const INDEX_PATH = path.join(CACHE_DIR, "filing-index.json");
const SCANNED_DATES_PATH = path.join(CACHE_DIR, "scanned-dates.json");
const CSV_CACHE_DIR = path.join(CACHE_DIR, "csv-cache");

const REQUEST_INTERVAL_MS = 300; // EDINET APIへの負荷を抑えるための最低間隔

type FilingIndex = Record<string, EdinetFiling[]>; // secCode -> 有価証券報告書一覧

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.mkdir(CSV_CACHE_DIR, { recursive: true });
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const text = await fs.readFile(filePath, "utf-8");
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(filePath: string, data: unknown) {
  await fs.writeFile(filePath, JSON.stringify(data), "utf-8");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * 指定した期間([from, to]、両端含む)の提出書類一覧をスキャンし、
 * 有価証券報告書(docTypeCode=120)のみをインデックスに追加する。
 * 既にスキャン済みの日付はスキップするため、中断しても再実行で継続できる。
 */
export async function scanFilingIndex(
  from: Date,
  to: Date,
  onProgress?: (done: number, total: number, date: string) => void
): Promise<void> {
  if (!isEdinetConfigured()) throw new Error("EDINET_API_KEY is not configured");
  await ensureCacheDir();

  const index = await readJson<FilingIndex>(INDEX_PATH, {});
  const scannedDates = new Set(await readJson<string[]>(SCANNED_DATES_PATH, []));

  const dates: string[] = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    dates.push(toDateStr(d));
  }
  const pending = dates.filter((d) => !scannedDates.has(d));

  let done = 0;
  for (const date of pending) {
    const filings = await listFilingsForDate(date);
    for (const f of filings) {
      if (f.docTypeCode !== SECURITIES_REPORT_DOC_TYPE_CODE || !f.secCode) continue;
      if (!index[f.secCode]) index[f.secCode] = [];
      if (!index[f.secCode].some((existing) => existing.docID === f.docID)) {
        index[f.secCode].push(f);
      }
    }
    scannedDates.add(date);
    done++;
    onProgress?.(done, pending.length, date);

    // 一定件数ごとに保存し、中断時の再スキャンを最小化する
    if (done % 20 === 0) {
      await writeJson(INDEX_PATH, index);
      await writeJson(SCANNED_DATES_PATH, Array.from(scannedDates));
    }
    await sleep(REQUEST_INTERVAL_MS);
  }

  await writeJson(INDEX_PATH, index);
  await writeJson(SCANNED_DATES_PATH, Array.from(scannedDates));
}

/**
 * 10年分などの長期履歴を得るために必要な走査期間を生成する。
 * 1件の報告書が「当期+過去4期」=5年分をカバーするため、約5年おきの窓をスキャンすればよい。
 * 各窓は提出時期のばらつき(決算期が3月以外の会社)を吸収するため14ヶ月幅とする。
 */
export function buildScanWindows(yearsBack: number, referenceDate = new Date()): { from: Date; to: Date }[] {
  const hops = Math.max(1, Math.ceil(yearsBack / 5));
  const windows: { from: Date; to: Date }[] = [];

  for (let k = 0; k < hops; k++) {
    const center = new Date(referenceDate);
    center.setFullYear(center.getFullYear() - k * 5);
    const from = new Date(center);
    from.setMonth(from.getMonth() - 14);
    const to = new Date(center);
    windows.push({ from, to });
  }
  return windows;
}

async function loadIndex(): Promise<FilingIndex> {
  return readJson<FilingIndex>(INDEX_PATH, {});
}

async function fetchCsvRowsCached(docID: string): Promise<EdinetCsvRow[]> {
  await ensureCacheDir();
  const cachePath = path.join(CSV_CACHE_DIR, `${docID}.json`);
  const cached = await readJson<EdinetCsvRow[] | null>(cachePath, null);
  if (cached) return cached;

  const zip = await downloadCsvZip(docID);
  const rows = await extractCsvRows(zip);
  await writeJson(cachePath, rows);
  await sleep(REQUEST_INTERVAL_MS);
  return rows;
}

const METRIC_ELEMENTS = {
  eps: "jpcrp_cor:BasicEarningsLossPerShareSummaryOfBusinessResults",
  dividendPerShare: "jpcrp_cor:DividendPaidPerShareSummaryOfBusinessResults",
  equityRatio: "jpcrp_cor:EquityToAssetRatioSummaryOfBusinessResults",
} as const;

function contextYearOffset(contextId: string): number | null {
  if (/^CurrentYearDuration/.test(contextId)) return 0;
  const m = contextId.match(/^Prior(\d)YearDuration/);
  return m ? Number(m[1]) : null;
}

/** 連結優先(NonConsolidatedMemberの付かない方)でコンテキストを選ぶための優先度 */
function contextPriority(contextId: string): number {
  return contextId.includes("NonConsolidated") ? 1 : 0;
}

interface ExtractedYearMetrics {
  fiscalYear: number;
  eps?: number;
  dividendPerShare?: number;
  equityRatio?: number;
  offsetFromFiling: number; // このデータが「直近報告書からどれだけ遡った期か」(小さいほど信頼度が高い)
}

function extractYearMetricsFromRows(
  rows: { elementId: string; contextId: string; value: string }[],
  filingPeriodEndYear: number
): ExtractedYearMetrics[] {
  const byOffset = new Map<number, { eps?: [number, number]; dividendPerShare?: [number, number]; equityRatio?: [number, number] }>();

  for (const row of rows) {
    let metric: keyof typeof METRIC_ELEMENTS | null = null;
    for (const [key, elementId] of Object.entries(METRIC_ELEMENTS)) {
      if (row.elementId === elementId) {
        metric = key as keyof typeof METRIC_ELEMENTS;
        break;
      }
    }
    if (!metric) continue;

    const offset = contextYearOffset(row.contextId);
    if (offset === null) continue;

    const num = Number(row.value);
    if (!Number.isFinite(num)) continue;

    const priority = contextPriority(row.contextId);
    const entry = byOffset.get(offset) ?? {};
    const existing = entry[metric];
    if (!existing || priority < existing[1]) {
      entry[metric] = [num, priority];
    }
    byOffset.set(offset, entry);
  }

  const results: ExtractedYearMetrics[] = [];
  for (const [offset, values] of byOffset.entries()) {
    results.push({
      fiscalYear: filingPeriodEndYear - offset,
      eps: values.eps?.[0],
      dividendPerShare: values.dividendPerShare?.[0],
      equityRatio: values.equityRatio?.[0],
      offsetFromFiling: offset,
    });
  }
  return results;
}

/**
 * 指定した証券コードについて、キャッシュ済みのEDINETインデックスから
 * 有価証券報告書を必要な件数分ダウンロード・解析し、長期のEPS/配当/自己資本比率履歴を返す。
 * scanFilingIndex() で事前にインデックスを構築しておく必要がある。
 */
export async function fetchLongHistoryFinancials(
  ticker: string,
  yearsBack: number
): Promise<FinancialYearRecord[]> {
  if (!isEdinetConfigured()) return [];

  const index = await loadIndex();
  const secCode = tickerToSecCode(ticker);
  const filings = (index[secCode] ?? [])
    .filter((f) => f.periodEnd)
    .sort((a, b) => (b.periodEnd! < a.periodEnd! ? -1 : 1));

  if (filings.length === 0) return [];

  // 直近報告書から約5年おきに間引いて選ぶ(hopごとに1件で十分カバーできるため)
  const hops = Math.max(1, Math.ceil(yearsBack / 5));
  const selected: EdinetFiling[] = [];
  let lastYear: number | null = null;
  for (const f of filings) {
    const year = Number(f.periodEnd!.slice(0, 4));
    if (lastYear !== null && lastYear - year < 4) continue; // 直前に選んだものと近すぎる場合はスキップ
    selected.push(f);
    lastYear = year;
    if (selected.length >= hops) break;
  }

  const byYear = new Map<number, ExtractedYearMetrics>();
  for (const filing of selected) {
    try {
      const rows = await fetchCsvRowsCached(filing.docID);
      const periodEndYear = Number(filing.periodEnd!.slice(0, 4));
      const yearMetrics = extractYearMetricsFromRows(rows, periodEndYear);
      for (const ym of yearMetrics) {
        const existing = byYear.get(ym.fiscalYear);
        if (!existing || ym.offsetFromFiling < existing.offsetFromFiling) {
          byYear.set(ym.fiscalYear, ym);
        }
      }
    } catch (err) {
      console.warn(`[edinet] ${ticker} (docID=${filing.docID}) の取得に失敗:`, err);
    }
  }

  return Array.from(byYear.values())
    .sort((a, b) => a.fiscalYear - b.fiscalYear)
    .map((ym) => ({
      fiscalYear: ym.fiscalYear,
      fiscalPeriodEndDate: `${ym.fiscalYear}-03-31`, // 正確な決算日ではなく年度の近似値
      eps: ym.eps,
      dividendPerShare: ym.dividendPerShare,
      equityRatio: ym.equityRatio,
      isForecast: false,
    }));
}
