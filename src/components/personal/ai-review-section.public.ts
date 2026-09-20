// 公開ビルド用のスタブ。next.config.ts で個人モードでないときに
// ai-review-section.tsx の代わりに解決され、個人用のUI・DBコードが一切バンドルされないようにする。

export const AiReviewSection = null;

export async function reviewedStockCodes(): Promise<string[]> {
  return [];
}
