import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { loadPublishedProfiles, loadPublishedReviews, loadScreeningSnapshot, loadStockDetail } from "@/lib/static-data";
import { ReviewCard } from "@/components/ai/review-card";
import { CompanyProfileCard } from "@/components/ai/company-profile-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriceChart } from "@/components/charts/price-chart";
import { EpsDividendChart } from "@/components/charts/eps-dividend-chart";
import { WatchButton } from "@/components/screener/watch-button";
import { formatPercent, formatYen } from "@/lib/utils";
import type { RuleBreakdown } from "@/lib/screening/types";
import { collectConcerns } from "@/lib/screening/factors";

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
  // 個人モードでは DB の会社概要・AI総評 (生成ボタン付き) を、公開サイトでは
  // content/ai/*.json に書き出した公開用の総評・概要 (表示のみ) を出す
  const personal = process.env.PERSONAL_MODE === "1" ? await import("@/components/personal/personal-sections") : null;

  const [staticDetail, snapshot] = await Promise.all([loadStockDetail(code), loadScreeningSnapshot()]);
  // 公開用JSONは上位50社ぶんしかないため、個人モードでは保有銘柄などをDBから組み立てて開けるようにする
  const detail = staticDetail ?? (personal ? await personal.stockDetailFromDb(code) : null);
  if (!detail) notFound();

  const criteria = snapshot.criteria;
  const screening = detail.screening;
  const health = screening.breakdown.financialHealth;
  // 総合の判定が良くても、内訳で弱い数値があれば理由を並べる
  const concerns = collectConcerns(screening.breakdown, criteria);

  const CompanyProfile = personal?.CompanyProfileSection ?? null;
  const AiReviewTeaser = personal?.AiReviewTeaser ?? null;
  const { OwnedHoldingBadge } = await import("@/components/personal/owned-ui");
  // 実際に買っている銘柄なら、保有数と平均取得単価を見出しに出す
  const position = personal ? (await personal.ownedPositions()).find((p) => p.code === code) ?? null : null;
  const [publishedReview, publishedProfile] = personal
    ? [null, null]
    : await Promise.all([
        loadPublishedReviews().then((rs) => rs.find((r) => r.stockCode === code) ?? null),
        loadPublishedProfiles().then((ps) => ps.find((p) => p.stockCode === code) ?? null),
      ]);

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
          {OwnedHoldingBadge && position && <OwnedHoldingBadge position={position} />}
          <WatchButton code={code} />
        </div>
      </div>

      {CompanyProfile && <CompanyProfile code={code} />}
      {publishedProfile && (
        <CompanyProfileCard
          profile={publishedProfile.profile}
          generatedAt={publishedProfile.generatedAt}
          model={publishedProfile.model}
        />
      )}

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

      {concerns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" />
              気になる点 ({concerns.length}件)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {screening.passedAllRules
                ? "条件はすべて満たしていますが、内訳のうち次の数値は弱めです。"
                : "次の数値が基準に届いていません。"}
            </p>
            <ul className="space-y-2">
              {concerns.map((c) => (
                <li key={c.key} className="rounded-md border border-slate-100 p-2 text-sm dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Badge variant={c.blocking ? "danger" : "warning"}>{c.blocking ? "基準未達" : "弱い"}</Badge>
                    <span className="font-medium text-slate-800 dark:text-slate-100">{c.label}</span>
                  </div>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">{c.reason}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>スクリーニング条件の判定内訳</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <RuleRow
            label={`配当利回り (${criteria.targetDividendYield}%前後が理想、合格帯 ${criteria.minDividendYield}〜${criteria.maxDividendYield}%)`}
            pass={screening.breakdown.dividendYield.pass}
            value={`${formatPercent(screening.breakdown.dividendYield.value)}${screening.breakdown.dividendYield.basis === "forward" ? " (会社予想)" : ""} ・ ${screening.breakdown.dividendYield.score.toFixed(0)}点`}
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
          <RuleRow
            label="増収増益 (直近決算と通期)"
            pass={screening.breakdown.earningsMomentum.pass}
            value={`${momentumLabel(screening.breakdown.earningsMomentum)} ・ ${screening.breakdown.earningsMomentum.score.toFixed(0)}点`}
          />
          <InfoRow
            label={`PER (${criteria.basePer}倍を基準に加減点)`}
            value={`${screening.breakdown.valuation.per !== null ? `${screening.breakdown.valuation.per.toFixed(1)}倍` : "-"} ・ ${screening.breakdown.valuation.score.toFixed(0)}点`}
          />
          <InfoRow
            label="現金確保 (現預金 ÷ 時価総額)"
            value={`${screening.breakdown.cash.cashToMarketCap !== null ? formatPercent(screening.breakdown.cash.cashToMarketCap, 1) : "-"} ・ ${screening.breakdown.cash.score.toFixed(0)}点`}
          />
          {(screening.breakdown.earningsMomentum.annual ||
            screening.breakdown.earningsMomentum.latestQuarter) && (
            <div className="sm:col-span-2 space-y-1 rounded-md border border-slate-100 px-3 py-2 text-sm dark:border-slate-800">
              {[screening.breakdown.earningsMomentum.annual, screening.breakdown.earningsMomentum.latestQuarter]
                .filter((p) => p !== null)
                .map((p) => (
                  <div key={p!.label} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-slate-500 dark:text-slate-400">{p!.label}</span>
                    <span>
                      売上 <YoY value={p!.revenueYoYPercent} /> ・ 純利益 <YoY value={p!.profitYoYPercent} />
                    </span>
                  </div>
                ))}
              {screening.breakdown.earningsMomentum.annualDataIssue && (
                <p className="text-amber-700 dark:text-amber-400">
                  {screening.breakdown.earningsMomentum.annualDataIssue}
                </p>
              )}
              {screening.breakdown.earningsMomentum.comparableYears > 0 && (
                <p className="text-slate-500 dark:text-slate-400">
                  通期の増収増益: {screening.breakdown.earningsMomentum.consecutiveGrowthYears}年連続
                  {screening.breakdown.earningsMomentum.consecutiveGrowthYears >=
                    screening.breakdown.earningsMomentum.comparableYears && "以上"}
                  {" "}(増収{screening.breakdown.earningsMomentum.consecutiveRevenueGrowthYears}年 / 増益
                  {screening.breakdown.earningsMomentum.consecutiveProfitGrowthYears}年)
                  <span className="ml-1 text-xs">
                    ※データソースの保有年数が{screening.breakdown.earningsMomentum.comparableYears + 1}年のため
                    最大{screening.breakdown.earningsMomentum.comparableYears}年まで
                  </span>
                </p>
              )}
              {screening.breakdown.earningsMomentum.negatives.length > 0 && (
                <p className="text-amber-700 dark:text-amber-400">
                  {screening.breakdown.earningsMomentum.negatives.join(" / ")}
                </p>
              )}
            </div>
          )}
          <div className="sm:col-span-2 text-sm text-slate-500 dark:text-slate-400">
            直近{criteria.evaluationHorizonMonths}ヶ月の株価騰落率:{" "}
            {screening.breakdown.priceChangeOverHorizon !== null
              ? `${screening.breakdown.priceChangeOverHorizon >= 0 ? "+" : ""}${screening.breakdown.priceChangeOverHorizon}%`
              : "-"}
            {" "}／ 直近3年配当利回りレンジ内の位置: {formatPercent(screening.breakdown.yieldRange.percentileInRange)}
            (100%に近いほど自社の過去レンジの中で割安な利回り)
          </div>
        </CardContent>
      </Card>

      {AiReviewTeaser && <AiReviewTeaser code={code} />}
      {publishedReview && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">AI総評 (直近ニュースを踏まえた評価)</h2>
          <ReviewCard
            code={code}
            name={detail.name}
            rank={screening.rank}
            review={publishedReview.review}
            generatedAt={publishedReview.generatedAt}
            model={publishedReview.model}
            anchorId="ai-review"
          />
        </div>
      )}
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

/** 合否のない参考指標 (PER・現金など) */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2 dark:border-slate-800">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

/** 増収増益の状態を短い日本語にする */
function momentumLabel(m: RuleBreakdown["earningsMomentum"]): string {
  const streak =
    m.consecutiveGrowthYears > 0
      ? `増収増益${m.consecutiveGrowthYears}年連続${m.consecutiveGrowthYears >= m.comparableYears ? "+" : ""}`
      : null;
  if (m.annualDataIssue && m.negatives.length === 0) return "直近決算のみで判定";
  if (m.isGrowingBoth) return streak ?? "増収増益";
  if (streak && m.negatives.length > 0) return `${streak} (直近は減速)`;
  if (m.negatives.length === 0) return "判定材料なし";
  const hasProfitDown = m.negatives.some((n) => n.includes("減益"));
  const hasRevenueDown = m.negatives.some((n) => n.includes("減収"));
  if (hasProfitDown && hasRevenueDown) return "減収減益";
  if (hasProfitDown) return "減益";
  return "減収";
}

/** 前年比を符号付きで色分けして表示する */
function YoY({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-400">-</span>;
  const cls = value >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  return (
    <span className={`font-medium ${cls}`}>
      {value >= 0 ? "+" : ""}
      {value}%
    </span>
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
