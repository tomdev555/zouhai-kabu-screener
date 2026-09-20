// 公開ページ (銘柄ページ・一覧) に個人モードのときだけ埋め込むセクション群 (サーバー側でDBから読む)。
// 公開ビルドでは next.config.ts の resolveAlias で personal-sections.public.ts に差し替えられ、
// ここのコードは一切バンドルされない。

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { isAiReviewConfigured, loadReviews } from "@/lib/personal/ai-review";
import { loadCompanyProfile } from "@/lib/personal/company-profile";
import { CompanyProfilePanel } from "./company-profile-panel";

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

function StanceBadge({ stance }: { stance: string }) {
  const variant =
    stance === "候補として有力" ? "success" : stance === "条件付きで検討" ? "warning" : stance === "見送り" ? "danger" : "default";
  return <Badge variant={variant}>{stance}</Badge>;
}

/** 一覧でAIバッジを出すための、総評が生成済みの銘柄コード一覧 */
export async function reviewedStockCodes(): Promise<string[]> {
  const reviews = await loadReviews();
  return reviews.filter((r) => r.review).map((r) => r.stockCode);
}
