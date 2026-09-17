// 静的サイト用のデータ読み込み。
// ビルド時に public/data/*.json を読むだけなので、公開サイトにはDBもサーバーも不要。

import { promises as fs } from "fs";
import path from "path";
import type { ScreeningCriteria, StockScreeningResult } from "./screening/types";

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

export async function loadScreeningSnapshot(): Promise<ScreeningSnapshot> {
  try {
    const text = await fs.readFile(path.join(DATA_DIR, "screening.json"), "utf-8");
    return JSON.parse(text) as ScreeningSnapshot;
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

export async function loadStockDetail(code: string): Promise<StockDetail | null> {
  try {
    const text = await fs.readFile(path.join(DATA_DIR, "stocks", `${code}.json`), "utf-8");
    return JSON.parse(text) as StockDetail;
  } catch {
    return null;
  }
}
