import { loadPublishedReviews, loadScreeningSnapshot } from "@/lib/static-data";
import { ScreenerTable } from "@/components/screener/screener-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ScreenerPage() {
  const snapshot = await loadScreeningSnapshot();
  const criteria = snapshot.criteria;

  // AI総評がある銘柄にバッジを付ける。個人モードはDB、公開サイトは content/ai/reviews.json を見る
  const personal = process.env.PERSONAL_MODE === "1";
  const reviewedCodes = personal
    ? await (await import("@/components/personal/personal-sections")).reviewedStockCodes()
    : (await loadPublishedReviews()).map((r) => r.stockCode);

  if (snapshot.results.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">増配株スクリーニング</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          データがまだ生成されていません。<code className="rounded bg-slate-100 px-1 dark:bg-slate-800">npm run refresh</code> と
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">npm run export:data</code> を実行してください。
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">増配株スクリーニング</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          EPS成長性・減配履歴・財務健全性・配当利回り(4%前後が理想)で足切りし、PER(15倍基準)と現金確保を加味したスコアで上位{criteria.targetCount}社をランキングします。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>評価対象銘柄数</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{snapshot.totalEvaluated}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>全条件クリア銘柄数</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
            {snapshot.passedCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>理想の配当利回り</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{criteria.targetDividendYield}%前後</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>減配なし年数の基準</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{criteria.minDividendCutFreeYears}年以上</CardContent>
        </Card>
      </div>

      <ScreenerTable results={snapshot.results} reviewedCodes={reviewedCodes} reviewHrefBase={personal ? "/my/reviews/" : "/ai-reviews/#"} />
    </div>
  );
}
