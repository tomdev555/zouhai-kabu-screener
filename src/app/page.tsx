import { loadScreeningSnapshot } from "@/lib/static-data";
import { ScreenerTable } from "@/components/screener/screener-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ScreenerPage() {
  const snapshot = await loadScreeningSnapshot();
  const criteria = snapshot.criteria;

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
          EPS成長性・減配履歴・財務健全性・配当利回りの4条件で銘柄を評価し、上位{criteria.targetCount}社をランキングします。
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
            <CardTitle>最低配当利回り</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{criteria.minDividendYield}%</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>減配なし年数の基準</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{criteria.minDividendCutFreeYears}年以上</CardContent>
        </Card>
      </div>

      <ScreenerTable results={snapshot.results} />
    </div>
  );
}
