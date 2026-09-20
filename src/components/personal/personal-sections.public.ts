// 公開ビルド用のスタブ。next.config.ts で個人モードでないときに
// personal-sections.tsx の代わりに解決され、個人用のUI・DBコードが一切バンドルされないようにする。

import type { NavItem } from "@/components/layout/sidebar-nav";

export const personalNavItems: NavItem[] = [];
export const CompanyProfileSection = null;
export const AiReviewTeaser = null;

export async function reviewedStockCodes(): Promise<string[]> {
  return [];
}
