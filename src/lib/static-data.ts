// 静的サイト用のデータ読み込み。
// ビルド時に public/data/*.json を読むだけなので、公開サイトにはDBもサーバーも不要。

import { promises as fs } from "fs";
import path from "path";
import type { EarningsMomentumCheck, ScreeningCriteria, StockScreeningResult } from "./screening/types";
import type { ProfileRecord, ReviewRecord } from "./ai/schemas";

const DATA_DIR = path.join(process.cwd(), "public", "data");

export interface ScreeningSnapshot {
  generatedAt: string;
  dataSource: string;
  criteria: ScreeningCriteria;
  totalEvaluated: number;
  passedCount: number;
  results: StockScreeningResult[];
}

export interface StockDetail {
  code: string;
  name: string;
  market: string | null;
  sector33: string | null;
  currentPrice: number | null;
  screening: StockScreeningResult;
  prices: { time: string; open: number; high: number; low: number; close: number; volume: number }[];
  epsDividend: {
    fiscalYear: number;
    eps: number | null;
    dividendPerShare: number | null;
    isSpecial: boolean;
  }[];
}

/** データ未生成でもビルドが通るように、空のスナップショットを返せるようにしておく */
const EMPTY_SNAPSHOT: ScreeningSnapshot = {
  generatedAt: "",
  dataSource: "",
  criteria: {} as ScreeningCriteria,
  totalEvaluated: 0,
  passedCount: 0,
  results: [],
};

/**
 * 業績モメンタム(増収増益の判定)は後から追加した項目なので、
 * それ以前に書き出したJSONを読んでも画面が壊れないように補う。
 */
const EMPTY_MOMENTUM: EarningsMomentumCheck = {
  latestQuarter: null,
  annual: null,
  isGrowingBoth: false,
  hasSevereAnnualDrop: false,
  negatives: [],
  score: 0,
  pass: true,
};

function withMomentum(result: StockScreeningResult): StockScreeningResult {
  if (result.breakdown?.earningsMomentum) return result;
  return { ...result, breakdown: { ...result.breakdown, earningsMomentum: EMPTY_MOMENTUM } };
}

export async function loadScreeningSnapshot(): Promise<ScreeningSnapshot> {
  try {
    const text = await fs.readFile(path.join(DATA_DIR, "screening.json"), "utf-8");
    const snapshot = JSON.parse(text) as ScreeningSnapshot;
    return { ...snapshot, results: (snapshot.results ?? []).map(withMomentum) };
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

export async function loadStockDetail(code: string): Promise<StockDetail | null> {
  try {
    const text = await fs.readFile(path.join(DATA_DIR, "stocks", `${code}.json`), "utf-8");
    const detail = JSON.parse(text) as StockDetail;
    return detail.screening ? { ...detail, screening: withMomentum(detail.screening) } : detail;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// ローカルで生成して公開用に書き出したAI総評・会社概要 (content/ai/*.json、npm run publish:ai で生成)
// 生成結果のテキストだけを含み、APIキー等は含まない。無ければ空を返す。
// ---------------------------------------------------------------------------

const AI_DIR = path.join(process.cwd(), "content", "ai");

export async function loadPublishedReviews(): Promise<ReviewRecord[]> {
  try {
    const text = await fs.readFile(path.join(AI_DIR, "reviews.json"), "utf-8");
    return (JSON.parse(text) as { reviews: ReviewRecord[] }).reviews ?? [];
  } catch {
    return [];
  }
}

export async function loadPublishedProfiles(): Promise<ProfileRecord[]> {
  try {
    const text = await fs.readFile(path.join(AI_DIR, "profiles.json"), "utf-8");
    return (JSON.parse(text) as { profiles: ProfileRecord[] }).profiles ?? [];
  } catch {
    return [];
  }
}
