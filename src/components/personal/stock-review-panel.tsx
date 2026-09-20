"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReviewCard } from "@/components/ai/review-card";
import type { ReviewItem } from "./reviews-client";

/** 個人モードのAI総評パネル。表示は共通の ReviewCard に任せ、生成・再生成ボタンを付ける。 */
export function StockReviewPanel({ item, configured }: { item: ReviewItem; configured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/my/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: item.code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "生成に失敗しました");
      if (json.failed?.length) throw new Error(json.failed[0].error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <Card>
        <CardContent className="py-4 text-sm text-amber-700 dark:text-amber-400">
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.env.local</code> に
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GEMINI_API_KEY</code> を設定すると使えます。
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">AI総評 (直近ニュースを踏まえた評価・自分用)</h2>
      <ReviewCard
        code={item.code}
        name={item.name}
        rank={item.rank}
        review={item.review?.review ?? null}
        generatedAt={item.review?.generatedAt}
        model={item.review?.model}
        rawText={item.review?.rawText}
        anchorId="ai-review"
        action={
          <Button size="sm" variant="outline" onClick={generate} disabled={busy}>
            <RefreshCw className={busy ? "animate-spin" : ""} />
            {item.review?.review ? "再生成" : "生成"}
          </Button>
        }
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {busy && <p className="text-sm text-slate-500 dark:text-slate-400">生成中… 20〜60秒ほどかかります。</p>}
    </div>
  );
}
