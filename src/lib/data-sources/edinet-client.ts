// EDINET API v2 (金融庁) クライアント。完全無料。
// https://disclosure2.edinet-fsa.go.jp/ のマイページでAPIキー(Subscription-Key)を発行する。
//
// 用途: J-Quantsの契約プランでは financial history が足りない場合に、
// 有価証券報告書のXBRL(CSV変換版)から「主要な経営指標等の推移」(EPS・1株配当・自己資本比率)
// の5年分を1件の提出書類からまとめて取得し、複数の提出年度の書類を組み合わせて長期履歴を作る。
//
// 参考: EDINET API仕様書 (Version 2), 2026年6月 金融庁企画市場局企業開示課

import JSZip from "jszip";

const BASE_URL = "https://api.edinet-fsa.go.jp/api/v2";

export const SECURITIES_REPORT_DOC_TYPE_CODE = "120"; // 有価証券報告書

export interface EdinetFiling {
  docID: string;
  edinetCode: string | null;
  secCode: string | null; // 5桁 (例: "72030"). 4桁の証券コードは末尾に "0" を付けたもの。
  filerName: string | null;
  docTypeCode: string | null;
  periodStart: string | null; // YYYY-MM-DD
  periodEnd: string | null; // YYYY-MM-DD
  submitDateTime: string | null;
  csvFlag: boolean;
}

function apiKey(): string {
  const key = process.env.EDINET_API_KEY;
  if (!key) throw new Error("EDINET_API_KEY is not configured");
  return key;
}

export function isEdinetConfigured(): boolean {
  return Boolean(process.env.EDINET_API_KEY);
}

/** 4桁の証券コードをEDINETのsecCode形式(5桁、末尾0)に変換する */
export function tickerToSecCode(ticker: string): string {
  return `${ticker}0`;
}

/** EDINETのsecCode(5桁)を4桁の証券コードに変換する (末尾0を除去) */
export function secCodeToTicker(secCode: string): string {
  return secCode.endsWith("0") ? secCode.slice(0, -1) : secCode;
}

async function requestJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("Subscription-Key", apiKey());

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`EDINET API error ${res.status} on ${path}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

/** 指定日に提出された書類の一覧を取得する (type=2: メタデータ+提出書類一覧) */
export async function listFilingsForDate(date: string): Promise<EdinetFiling[]> {
  const json = await requestJson<{ results?: Record<string, unknown>[] }>("/documents.json", {
    date,
    type: "2",
  });

  return (json.results ?? []).map((r) => ({
    docID: String(r.docID),
    edinetCode: (r.edinetCode as string) ?? null,
    secCode: (r.secCode as string) ?? null,
    filerName: (r.filerName as string) ?? null,
    docTypeCode: (r.docTypeCode as string) ?? null,
    periodStart: (r.periodStart as string) ?? null,
    periodEnd: (r.periodEnd as string) ?? null,
    submitDateTime: (r.submitDateTime as string) ?? null,
    csvFlag: r.csvFlag === "1",
  }));
}

/** 書類のCSV(XBRLをCSVに変換したもの)のZIPをダウンロードする (type=5) */
export async function downloadCsvZip(docID: string): Promise<ArrayBuffer> {
  const url = new URL(`${BASE_URL}/documents/${docID}`);
  url.searchParams.set("type", "5");
  url.searchParams.set("Subscription-Key", apiKey());

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`EDINET API error ${res.status} on documents/${docID}: ${body.slice(0, 300)}`);
  }
  return res.arrayBuffer();
}

export interface EdinetCsvRow {
  elementId: string; // 例: "jpcrp_cor:BasicEarningsLossPerShareSummaryOfBusinessResults"
  contextId: string; // 例: "CurrentYearDuration", "Prior1YearDuration_NonConsolidatedMember" 等
  value: string;
}

/**
 * type=5で取得したZIPから XBRL_TO_CSV/*.csv を全て読み込み、行データにフラット化する。
 * CSVは UTF-16LE + タブ区切り + 各値をダブルクオートで囲む形式。
 * 列名は "要素ID" "コンテキストID" "値" を中心に、名前で検索する(列順の変化に強くするため)。
 */
export async function extractCsvRows(zipData: ArrayBuffer): Promise<EdinetCsvRow[]> {
  const zip = await JSZip.loadAsync(zipData);
  const rows: EdinetCsvRow[] = [];

  const csvEntries = Object.values(zip.files).filter(
    (f) => !f.dir && f.name.startsWith("XBRL_TO_CSV/") && f.name.endsWith(".csv")
  );

  for (const entry of csvEntries) {
    const buf = await entry.async("nodebuffer");
    const text = decodeEdinetCsv(buf);
    rows.push(...parseEdinetCsv(text));
  }

  return rows;
}

function decodeEdinetCsv(buf: Buffer): string {
  // UTF-16LE。先頭にBOM(FF FE)が付いている場合は取り除く。
  let offset = 0;
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) offset = 2;
  return buf.toString("utf16le", offset);
}

function parseEdinetCsv(text: string): EdinetCsvRow[] {
  const lines = text.split(/\r\n|\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const header = splitTsvLine(lines[0]);
  const idxElement = header.findIndex((h) => h === "要素ID");
  const idxContext = header.findIndex((h) => h === "コンテキストID");
  const idxValue = header.findIndex((h) => h === "値");
  if (idxElement === -1 || idxContext === -1 || idxValue === -1) return [];

  const rows: EdinetCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitTsvLine(lines[i]);
    if (cols.length <= Math.max(idxElement, idxContext, idxValue)) continue;
    rows.push({
      elementId: cols[idxElement],
      contextId: cols[idxContext],
      value: cols[idxValue],
    });
  }
  return rows;
}

function splitTsvLine(line: string): string[] {
  return line.split("\t").map((cell) => {
    const trimmed = cell.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1).replace(/""/g, '"');
    }
    return trimmed;
  });
}
