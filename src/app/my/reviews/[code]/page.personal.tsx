import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { isAiReviewConfigured, loadReviews } from "@/lib/personal/ai-review";
import { loadLatestScreeningResults } from "@/lib/screening/engine";
import { StockReviewPanel } from "@/components/personal/stock-review-panel";

export const dynamic = "force-dynamic";

export default async function StockReviewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const stock = await prisma.stock.findUnique({ where: { code }, select: { name: true } });
  if (!stock) notFound();

  const [[review], results] = await Promise.all([loadReviews([code]), loadLatestScreeningResults()]);
  const rank = results.find((r) => r.code === code)?.rank ?? null;

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/my/reviews" className="inline-flex items-center gap-1 text-slate-500 hover:underline dark:text-slate-400">
          <ArrowLeft className="size-4" /> AI総評一覧
        </Link>
        <span className="text-slate-300 dark:text-slate-700">|</span>
        <Link href={`/stocks/${code}`} className="inline-flex items-center gap-1 text-emerald-800 hover:underline dark:text-emerald-400">
          <Building2 className="size-4" /> {stock.name} の会社概要・チャートを見る
        </Link>
      </div>

      <StockReviewPanel
        item={{ code, name: stock.name, rank, review: review ?? null }}
        configured={isAiReviewConfigured()}
      />
    </div>
  );
}
