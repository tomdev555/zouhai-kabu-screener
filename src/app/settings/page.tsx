import { loadScreeningSnapshot } from "@/lib/static-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function SettingsPage() {
  const snapshot = await loadScreeningSnapshot();
  const criteria = snapshot.criteria;

  const generatedAt = snapshot.generatedAt
    ? new Date(snapshot.generatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
    : "未生成";

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold">このサイトについて</h1>

      <Card>
        <CardHeader>
          <CardTitle>データ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>最終更新:</span>
            <Badge variant="success">{generatedAt}</Badge>
            <span className="text-slate-400">/ 取得元: {snapshot.dataSource || "-"}</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            上場銘柄一覧はJPX(日本取引所グループ)の公開データ、株価・配当履歴・財務指標は
            Yahoo Financeから取得しています。データは定期的に自動更新されます。
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-400">
            本サイトは銘柄選定の条件を機械的に当てはめた結果を表示するものであり、
            特定の銘柄の購入を推奨するものではありません。数値の正確性も保証できないため、
            実際の投資判断は必ずご自身で一次情報を確認した上で行ってください。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>スクリーニング条件</CardTitle>
        </CardHeader>
        <CardContent>
          {criteria?.targetCount ? (
            <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <li>配当利回り: {criteria.minDividendYield}% 〜 {criteria.maxDividendYield}%</li>
              <li>減配なし年数: {criteria.minDividendCutFreeYears}年以上</li>
              <li>
                財務健全性: 自己資本比率{criteria.minEquityRatio}%以上
                (自己資本比率が取れない場合はD/E比率{criteria.maxDebtToEquity}%以下で代替)
              </li>
              <li>EPS成長性スコア: {criteria.minEpsTrendScore}点以上 (100点満点)</li>
              <li>
                特別配当判定: 前後の年の平均に対して{criteria.specialDividendSpikeRatio}倍を超えたら
                一時的な特別配当とみなし、減配判定から除外
              </li>
              <li>選定銘柄数: 上位{criteria.targetCount}社</li>
            </ul>
          ) : (
            <p className="text-sm text-slate-400">データがまだ生成されていません。</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ウォッチリスト・運用実績について</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ウォッチリストと運用実績に入力した内容は、お使いのブラウザ内にのみ保存されます。
            サーバーには送信されないため、他の閲覧者に見えることはありません。
            一方で、ブラウザのデータを消したり別の端末で開いたりすると内容は引き継がれません。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
