// 公開ページ (銘柄ページ・一覧) に個人モードのときだけ埋め込むセクション群 (サーバー側でDBから読む)。
// 公開ビルドでは next.config.ts の resolveAlias で personal-sections.public.ts に差し替えられ、
// ここのコードは一切バンドルされない。

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { isAiReviewConfigured, loadReviews } from "@/lib/personal/ai-review";
import { loadCompanyProfile } from "@/lib/personal/company-profile";
import { computePortfolio } from "@/lib/personal/positions";
import { prisma } from "@/lib/db";
import type { RuleBreakdown, StockScreeningResult } from "@/lib/screening/types";
import { computeScreeningForStock } from "@/lib/screening/engine";
import type { StockDetail } from "@/lib/static-data";

const DETAIL_PRICE_YEARS = 3;
import { CompanyProfilePanel } from "./company-profile-panel";
import { StanceBadge } from "@/components/ai/review-card";
import type { NavItem } from "@/components/layout/sidebar-nav";

/** サイドバーに追加する個人モードのメニュー */
export const personalNavItems: NavItem[] = [
  { href: "/my/reviews", label: "AI総評の生成 (上位10社)", icon: "sparkles" },
  { href: "/my", label: "マイポートフォリオ", icon: "briefcase" },
];

/** 銘柄ページの先頭に出す四季報風の会社概要 */
export async function CompanyProfileSection({ code }: { code: string }) {
  const profile = await loadCompanyProfile(code);
  return <CompanyProfilePanel code={code} profile={profile} configured={isAiReviewConfigured()} />;
}

/** 銘柄ページの末尾に出す、AI総評へのコンパクトな導線 */
export async function AiReviewTeaser({ code }: { code: string }) {
  const [review] = await loadReviews([code]);
  const r = review?.review ?? null;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Sparkles className="size-4 text-violet-500" />
          <span className="font-medium">AI総評</span>
          {r ? (
            <>
              <StanceBadge stance={r.stance} />
              <span className="text-slate-600 dark:text-slate-300">{r.headline}</span>
            </>
          ) : (
            <span className="text-slate-400">まだ生成されていません</span>
          )}
        </div>
        <Link
          href={`/my/reviews/${code}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-violet-700 hover:underline dark:text-violet-300"
        >
          {r ? "総評を読む" : "総評を生成する"} <ArrowRight className="size-4" />
        </Link>
      </CardContent>
    </Card>
  );
}

/** 一覧・銘柄ページで「保有中」を出すための、実際に買って今も持っている銘柄 */
export async function ownedPositions(): Promise<
  { code: string; quantity: number; averageCost: number; unrealizedPnlPct: number | null }[]
> {
  const portfolio = await computePortfolio();
  return portfolio.positions
    .filter((p) => p.quantity > 0)
    .map((p) => ({
      code: p.stockCode,
      quantity: p.quantity,
      averageCost: p.averageCost,
      unrealizedPnlPct: p.unrealizedPnlPct,
    }));
}

/**
 * 指定した銘柄の、直近のスクリーニング結果を読む。
 * 保有していても上位50社に入っていない銘柄は公開用JSONに含まれないため、一覧に足すのに使う。
 */
export async function screeningResultsForCodes(codes: string[]): Promise<StockScreeningResult[]> {
  if (codes.length === 0) return [];
  const run = await prisma.screeningRun.findFirst({ orderBy: { runAt: "desc" }, select: { id: true } });
  if (!run) return [];

  const rows = await prisma.screeningResult.findMany({
    where: { screeningRunId: run.id, stockCode: { in: codes } },
    include: { stock: { select: { name: true, sector33: true, currentPrice: true } } },
  });

  return rows
    .filter((r) => r.ruleBreakdown)
    .map((r) => ({
      code: r.stockCode,
      name: r.stock.name,
      sector: r.stock.sector33 ?? undefined,
      currentPrice: r.stock.currentPrice ? Number(r.stock.currentPrice) : null,
      breakdown: JSON.parse(r.ruleBreakdown!) as RuleBreakdown,
      passedAllRules: r.passedAllRules,
      compositeScore: r.compositeScore ? Number(r.compositeScore) : 0,
      rank: r.rank,
    }));
}

/**
 * 銘柄ページの中身をDBから組み立てる。
 * 公開用JSONは上位50社ぶんしか書き出さないため、保有しているだけの銘柄を開いたときに使う。
 */
export async function stockDetailFromDb(code: string): Promise<StockDetail | null> {
  const from = new Date();
  from.setFullYear(from.getFullYear() - DETAIL_PRICE_YEARS);

  const [stock, prices, screening] = await Promise.all([
    prisma.stock.findUnique({
      where: { code },
      include: {
        financials: { orderBy: { fiscalYear: "asc" } },
        dividends: { orderBy: { fiscalYear: "asc" } },
      },
    }),
    prisma.priceDaily.findMany({ where: { stockCode: code, date: { gte: from } }, orderBy: { date: "asc" } }),
    computeScreeningForStock(code),
  ]);
  if (!stock || !screening) return null;

  const financialByYear = new Map(stock.financials.map((f) => [f.fiscalYear, f]));
  const dividendByYear = new Map(stock.dividends.map((d) => [d.fiscalYear, d]));
  const years = new Set([
    ...stock.financials.map((f) => f.fiscalYear),
    ...stock.dividends.map((d) => d.fiscalYear),
  ]);

  // 一覧に出している順位と揃えるため、保存済みの結果から順位を引く
  const [saved] = await screeningResultsForCodes([code]);

  return {
    code: stock.code,
    name: stock.name,
    market: stock.market,
    sector33: stock.sector33,
    currentPrice: stock.currentPrice ? Number(stock.currentPrice) : null,
    screening: { ...screening, rank: saved?.rank ?? null },
    prices: prices.map((p) => ({
      time: p.date.toISOString().slice(0, 10),
      open: Number(p.open),
      high: Number(p.high),
      low: Number(p.low),
      close: Number(p.close),
      volume: Number(p.volume),
    })),
    epsDividend: Array.from(years)
      .sort((a, b) => a - b)
      .map((fiscalYear) => {
        const f = financialByYear.get(fiscalYear);
        const d = dividendByYear.get(fiscalYear);
        return {
          fiscalYear,
          eps: f?.eps ? Number(f.eps) : null,
          dividendPerShare: d?.dividendPerShare ? Number(d.dividendPerShare) : null,
          isSpecial: d?.isSpecial ?? false,
        };
      }),
  };
}

/** 一覧でAIバッジを出すための、総評が生成済みの銘柄コード一覧 */
export async function reviewedStockCodes(): Promise<string[]> {
  const reviews = await loadReviews();
  return reviews.filter((r) => r.review).map((r) => r.stockCode);
}
