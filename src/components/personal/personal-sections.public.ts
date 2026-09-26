// 公開ビルド用のスタブ。next.config.ts で個人モードでないときに
// personal-sections.tsx の代わりに解決され、個人用のUI・DBコードが一切バンドルされないようにする。

import type { NavItem } from "@/components/layout/sidebar-nav";

export const personalNavItems: NavItem[] = [];
export const CompanyProfileSection = null;
export const AiReviewTeaser = null;

export async function reviewedStockCodes(): Promise<string[]> {
  return [];
}

export async function screeningResultsForCodes(): Promise<never[]> {
  return [];
}

export async function stockDetailFromDb(): Promise<null> {
  return null;
}

export async function ownedPositions(): Promise<
  { code: string; quantity: number; averageCost: number; unrealizedPnlPct: number | null }[]
> {
  return [];
}
