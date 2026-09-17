import { createJQuantsProviderFromEnv, isJQuantsConfigured } from "./jquants-client";
import { MockDataProvider } from "./mock-provider";
import { YahooFinanceProvider } from "./yahoo-provider";
import type { DataProvider } from "./types";

let cached: DataProvider | null = null;

/**
 * データソースの優先順位:
 * 1. J-Quants API (JQUANTS_API_KEY を設定した場合。公式データで最も正確)
 * 2. JPX銘柄一覧 + Yahoo Finance (設定不要のデフォルト)
 * 3. モックデータ (USE_MOCK_DATA=1 を指定した場合のみ。UI確認・デモ用)
 */
export function getDataProvider(): DataProvider {
  if (cached) return cached;

  if (process.env.USE_MOCK_DATA === "1") {
    cached = new MockDataProvider();
  } else {
    cached = createJQuantsProviderFromEnv() ?? new YahooFinanceProvider();
  }
  return cached;
}

export function isUsingMockData(): boolean {
  return process.env.USE_MOCK_DATA === "1";
}

export function getDataSourceLabel(): string {
  if (isUsingMockData()) return "モックデータ (デモ)";
  return isJQuantsConfigured() ? "J-Quants API" : "JPX + Yahoo Finance (設定不要)";
}

export * from "./types";
