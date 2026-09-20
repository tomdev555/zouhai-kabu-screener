import { isAiReviewConfigured, loadReviews, topStockCodes } from "@/lib/personal/ai-review";
import { ReviewsClient } from "@/components/personal/reviews-client";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const [top, reviews] = await Promise.all([topStockCodes(10), loadReviews()]);
  const reviewByCode = new Map(reviews.map((r) => [r.stockCode, r]));

  const items = top.map((t) => ({
    ...t,
    review: reviewByCode.get(t.code) ?? null,
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">AI総評 (スクリーニング上位10社)</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Claudeが各銘柄の最新ニュース・決算・開示をWeb検索し、スクリーニングの数字だけでは見えない
          リスクや状況を整理します。投資助言ではなく判断材料の整理です。
        </p>
      </div>

      <ReviewsClient items={items} configured={isAiReviewConfigured()} />
    </div>
  );
}
