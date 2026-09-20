// 個別銘柄ページに埋め込むAI総評 (サーバー側でDBから読む)。
// 個人モードのときだけ page.tsx から動的importされる。公開ビルドでは呼ばれない。

import { isAiReviewConfigured, loadReviews } from "@/lib/personal/ai-review";
import { StockReviewPanel } from "./stock-review-panel";

export async function AiReviewSection({
  code,
  name,
  rank,
}: {
  code: string;
  name: string;
  rank: number | null;
}) {
  const [review] = await loadReviews([code]);
  return (
    <StockReviewPanel
      item={{ code, name, rank, review: review ?? null }}
      configured={isAiReviewConfigured()}
    />
  );
}

/** 一覧でAIバッジを出すための、総評が生成済みの銘柄コード一覧 */
export async function reviewedStockCodes(): Promise<string[]> {
  const reviews = await loadReviews();
  return reviews.filter((r) => r.review).map((r) => r.stockCode);
}
