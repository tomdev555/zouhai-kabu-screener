"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReviewCard } from "@/components/ai/review-card";
import type { StoredReview } from "@/lib/personal/ai-review";

export interface ReviewItem {
  code: string;
  name: string;
  rank: number | null;
  review: StoredReview | null;
}

export function ReviewsClient({ items, configured }: { items: ReviewItem[]; configured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null); // "all" | code
  const [message, setMessage] = useState<string | null>(null);

  async function generate(body: Record<string, unknown>, label: string) {
    setBusy(label);
    setMessage(
      label === "all"
        ? "生成中… 1銘柄あたり30秒〜1分程度、無料枠の制限に合わせて間隔を空けて実行します。このページを開いたままお待ちください。"
        : "生成中…"
    );
    try {
      const res = await fetch("/api/my/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "失敗しました");
      const parts = [];
      if (json.generated?.length) parts.push(`生成 ${json.generated.length}件`);
      if (json.skipped?.length) parts.push(`24時間以内のためスキップ ${json.skipped.length}件`);
      if (json.failed?.length)
        parts.push(
          `失敗 ${json.failed.length}件 (${json.failed.map((f: { code: string; error: string }) => `${f.code}: ${f.error}`).join(" / ")})`
        );
      setMessage(parts.join(" ・ ") || "完了");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "失敗しました");
    } finally {
      setBusy(null);
    }
  }

  const missing = items.filter((i) => !i.review?.review).length;

  return (
    <div className="space-y-6">
      {!configured && (
        <Card>
          <CardContent className="py-4 text-sm text-amber-700 dark:text-amber-400">
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.env.local</code> に
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GEMINI_API_KEY</code> を設定してサーバーを再起動すると使えるようになります。
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => generate({ top: 10 }, "all")} disabled={!configured || busy !== null}>
          <Sparkles className={busy === "all" ? "animate-pulse" : ""} />
          {busy === "all" ? "生成中…" : missing > 0 ? `未生成の${missing}銘柄を生成` : "上位10社を更新 (24時間以内はスキップ)"}
        </Button>
        <Button variant="outline" onClick={() => generate({ top: 10, force: true }, "all")} disabled={!configured || busy !== null}>
          <RefreshCw /> 全件を強制再生成
        </Button>
        {message && <span className="text-sm text-slate-500 dark:text-slate-400">{message}</span>}
      </div>

      <div className="space-y-4">
        {items.map((item) => (
          <ReviewCard
            key={item.code}
            code={item.code}
            name={item.name}
            rank={item.rank}
            review={item.review?.review ?? null}
            generatedAt={item.review?.generatedAt}
            model={item.review?.model}
            rawText={item.review?.rawText}
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => generate({ code: item.code }, item.code)}
                disabled={!configured || busy !== null}
              >
                <RefreshCw className={busy === item.code ? "animate-spin" : ""} />
                {item.review?.review ? "再生成" : "生成"}
              </Button>
            }
          />
        ))}
      </div>
    </div>
  );
}
