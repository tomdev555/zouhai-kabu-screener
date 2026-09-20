import { notFound } from "next/navigation";
import { loadScreeningSnapshot, loadStockDetail } from "@/lib/static-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriceChart } from "@/components/charts/price-chart";
import { EpsDividendChart } from "@/components/charts/eps-dividend-chart";
import { WatchButton } from "@/components/screener/watch-button";
import { formatPercent, formatYen } from "@/lib/utils";

/** 静的書き出しの対象: スクリーニング上位にランクインした銘柄のみ */
export async function generateStaticParams() {
  const snapshot = await loadScreeningSnapshot();
  return snapshot.results.map((r) => ({ code: r.code }));
}

export default async function StockDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const [detail, snapshot] = await Promise.all([loadStockDetail(code), loadScreeningSnapshot()]);
  if (!detail) notFound();

  const criteria = snapshot.criteria;
  const screening = detail.screening;
  const health = screening.breakdown.financialHealth;

  // 個人モードのときだけ会社概要とAI総評への導線を表示する。公開ビルドではスタブ(null)に差し替わる
  const personal = process.env.PERSONAL_MODE === "1" ? await import("@/components/personal/personal-sections") : null;
  const CompanyProfile = personal?.CompanyProfileSection ?? null;
  const AiReviewTeaser = personal?.AiReviewTeaser ?? null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{detail.name}</h1>
            <span className="text-sm text-slate-400">{detail.code}</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {detail.market} ・ {detail.sector33}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {screening.passedAllRules ? (
            <Badge variant="success">スクリーニング条件クリア (順位 {screening.rank ?? "-"})</Badge>
          ) : (
            <Badge variant="outline">基準未達</Badge>
          )}
          <WatchButton code={code} />
        </div>
      </div>

      {CompanyProfile && <CompanyProfile code={code} />}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="現在値" value={formatYen(detail.currentPrice)} />
        <StatCard label="配当利回り" value={formatPercent(screening.breakdown.dividendYield.value)} />
        <StatCard label="減配なし年数" value={`${screening.breakdown.dividendCutFree.years}年`} />
        <StatCard
          label={health.metric === "debtToEquity" ? "D/E比率" : "自己資本比率"}
          value={formatPercent(health.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>株価チャート</CardTitle>
        </CardHeader>
        <CardContent>
          <PriceChart data={detail.prices} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>EPS・配当履歴 (オレンジ色は特別配当と判定した年)</CardTitle>
        </CardHeader>
        <CardContent>
          <EpsDividendChart data={detail.epsDividend} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>スクリーニング条件の判定内訳</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <RuleRow
            label={`配当利回り (${criteria.minDividendYield}%〜${criteria.maxDividendYield}%)`}
            pass={screening.breakdown.dividendYield.pass}
            value={formatPercent(screening.breakdown.dividendYield.value)}
          />
          <RuleRow
            label={`減配なし年数 (${criteria.minDividendCutFreeYears}年以上)`}
            pass={screening.breakdown.dividendCutFree.pass}
            value={`${screening.breakdown.dividendCutFree.years}年`}
          />
          <RuleRow
            label={
              health.metric === "debtToEquity"
                ? `D/E比率 (${criteria.maxDebtToEquity}%以下)`
                : `自己資本比率 (${criteria.minEquityRatio}%以上)`
            }
            pass={health.pass}
            value={formatPercent(health.value)}
          />
          <RuleRow
            label={`EPS成長性スコア (${criteria.minEpsTrendScore}点以上)`}
            pass={screening.breakdown.epsTrend.pass}
            value={`${screening.breakdown.epsTrend.score.toFixed(0)}点 (CAGR ${screening.breakdown.epsTrend.cagrPercent ?? "-"}%)`}
          />
          <div className="sm:col-span-2 text-sm text-slate-500 dark:text-slate-400">
            直近3年配当利回りレンジ内の位置: {formatPercent(screening.breakdown.yieldRange.percentileInRange)}
            (100%に近いほど自社の過去レンジの中で割安な利回り)
          </div>
        </CardContent>
      </Card>

      {AiReviewTeaser && <AiReviewTeaser code={code} />}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-xl font-semibold">{value}</CardContent>
    </Card>
  );
}

function RuleRow({ label, pass, value }: { label: string; pass: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2 dark:border-slate-800">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-sm font-medium">{value}</span>
        <Badge variant={pass ? "success" : "danger"}>{pass ? "OK" : "NG"}</Badge>
      </span>
    </div>
  );
}
