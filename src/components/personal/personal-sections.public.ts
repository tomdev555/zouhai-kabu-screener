// 公開ビルド用のスタブ。next.config.ts で個人モードでないときに
// personal-sections.tsx の代わりに解決され、個人用のUI・DBコードが一切バンドルされないようにする。

export const CompanyProfileSection = null;
export const AiReviewTeaser = null;

export async function reviewedStockCodes(): Promise<string[]> {
  return [];
}
