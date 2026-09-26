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
          <CardTitle>何をするサイトか</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
          <p>
            日本の上場企業約3,700社の中から「長く増配を続けている割安な会社」を毎朝自動で探して、
            上位{criteria?.targetCount ?? 50}社を表示します。
          </p>

          <div>
            <h3 className="mb-1.5 font-medium">選ぶ条件 (4つ全部を満たした会社だけ)</h3>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                <b>{criteria?.minDividendCutFreeYears ?? 10}年以上、配当を減らしていない</b>
                (一時的な特別配当は除いて判定)
              </li>
              <li><b>利益 (EPS) が伸びている</b></li>
              <li><b>借金が少ない</b> (有利子負債が自己資本の{((criteria?.maxDebtToEquity ?? 150) / 100).toFixed(1)}倍以下)</li>
              <li>
                <b>増収増益が基本</b> (直近の決算や通期で大きく減収・減益になっていない)
              </li>
              <li>
                <b>配当利回りが{criteria?.minDividendYield ?? 2.5}〜{criteria?.maxDividendYield ?? 6}%</b>
                (会社の今期予想ベース。予想がない会社は直近1年の実績)
              </li>
            </ol>
          </div>

          <div>
            <h3 className="mb-1.5 font-medium">順位のつけ方</h3>
            <p className="mb-1 text-slate-500 dark:text-slate-400">条件を満たした会社を、次の考え方で点数化して並べています。</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                配当利回りは<b>{criteria?.targetDividendYield ?? 4}%前後が理想</b>。高すぎる (減配の前兆かも) も低すぎる (買われすぎ) も減点
              </li>
              <li><b>PERは{criteria?.basePer ?? 15}倍を基準</b>に、安いほど加点</li>
              <li><b>現金を多く持っている</b>会社を加点</li>
              <li>
                <b>直近の決算と通期が増収増益</b>なら満点。減収・減益は減点し、とくに通期の減益は重く見ます
              </li>
              <li>減配なしの年数が長いほど、利益の伸びが大きいほど加点</li>
            </ul>
          </div>

          <div>
            <h3 className="mb-1.5 font-medium">AI総評について</h3>
            <p>
              上位の会社ごとに、直近半年のニュース・開示の見出しと財務データをAIが読んで「数字だけでは見えないリスク」をまとめています
              (証券会社の格下げ、主力商品の問題、業績の下方修正など)。
              減収・減益になっている会社については、会社が出した説明を探して原因を突き止め、
              それが一時的なものか構造的なものかを判定します。
              スタンス (候補として有力／条件付き／様子見／見送り) は目安です。
              AIは記事の本文までは読んでおらず、生成後に順位や状況が変わることもあります。
            </p>
          </div>

          <div className="rounded-md bg-amber-50 p-3 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <h3 className="mb-1 font-medium">注意</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>投資助言ではなく、機械的な絞り込みとAIの要約です。数字の誤りやAIの勘違いもありえます</li>
              <li>買う前に、その会社の決算資料や出典のニュースを自分で確認してください</li>
              <li>株価データは前日終値で毎朝自動更新。AI総評は不定期更新 (各カードに生成日を表示)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

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
              <li>
                配当利回り: {criteria.targetDividendYield}%前後が理想 (高すぎても低すぎても減点)。合格帯は{criteria.minDividendYield}%〜{criteria.maxDividendYield}%。
                会社予想の今期配当があればそれで計算
              </li>
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
              <li>
                増収増益: 直近決算(短信)と通期の前年比。減収・減益で減点し、通期の減益をいちばん重く見る。
                スコア{criteria.minEarningsMomentumScore}点未満 (通期で{criteria.severeAnnualProfitDropPercent}%を
                大きく超える減益など) は足切り
              </li>
              <li>PER: {criteria.basePer}倍を基準に、安いほど加点・割高なほど減点 (足切りなし)</li>
              <li>現金確保: 現預金÷時価総額が{criteria.cashRatioFullScore}%以上で満点 (足切りなし)</li>
              <li>評価の目安期間: 約{criteria.evaluationHorizonMonths}ヶ月 (騰落率の参考表示に使用)</li>
              <li>選定銘柄数: 上位{criteria.targetCount}社</li>
            </ul>
          ) : (
            <p className="text-sm text-slate-400">データがまだ生成されていません。</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ウォッチリストについて</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ウォッチリストに登録した内容は、お使いのブラウザ内にのみ保存されます。
            サーバーには送信されないため、他の閲覧者に見えることはありません。
            一方で、ブラウザのデータを消したり別の端末で開いたりすると内容は引き継がれません。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
