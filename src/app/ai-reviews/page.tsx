import { loadPublishedReviews, loadScreeningSnapshot } from "@/lib/static-data";
import { ReviewCard } from "@/components/ai/review-card";
import { Card, CardContent } from "@/components/ui/card";

// 公開サイト用のAI総評一覧。content/ai/reviews.json (ローカルで生成して書き出したもの) を表示するだけで、
// このページ自体はAIを呼ばない。

export default async function AiReviewsPage() {
  const [reviews, snapshot] = await Promise.all([loadPublishedReviews(), loadScreeningSnapshot()]);
  const rankByCode = new Map(snapshot.results.map((r) => [r.code, r.rank]));

  // 現在のスクリーニング順位が付いているものを先に、その後は生成日時の新しい順
  const sorted = [...reviews].sort((a, b) => {
    const ra = rankByCode.get(a.stockCode) ?? Infinity;
    const rb = rankByCode.get(b.stockCode) ?? Infinity;
    if (ra !== rb) return ra - rb;
    return b.generatedAt.localeCompare(a.generatedAt);
  });

  const latest = reviews.reduce((m, r) => (r.generatedAt > m ? r.generatedAt : m), "");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">AI総評</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          スクリーニング上位銘柄について、直近6ヶ月のニュース・開示の見出しと財務データをもとに、数字だけでは見えないリスクや状況をAIが整理したものです。
          生成後に順位が変わることがあるため、現在50位圏外の銘柄もそのまま掲載しています。
          {latest && ` 最終生成: ${new Date(latest).toLocaleDateString("ja-JP")}`}
        </p>
      </div>

      <Card>
        <CardContent className="py-3 text-xs text-amber-700 dark:text-amber-400">
          AIが公開情報を要約・評価したものであり、投資助言ではありません。事実誤認を含む可能性があるため、
          気になった点は必ず出典や一次情報を確認してください。
        </CardContent>
      </Card>

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-400">まだ公開されている総評はありません。</p>
      ) : (
        <div className="space-y-4">
          {sorted.map((r) => (
            <div key={r.stockCode} id={r.stockCode} className="scroll-mt-6">
              <ReviewCard
                code={r.stockCode}
                name={r.stockName}
                rank={rankByCode.get(r.stockCode) ?? null}
                outOfRanking={!rankByCode.has(r.stockCode)}
                review={r.review}
                generatedAt={r.generatedAt}
                model={r.model}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
