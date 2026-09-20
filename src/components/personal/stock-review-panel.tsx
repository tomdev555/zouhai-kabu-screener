"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { ReviewCard, type ReviewItem } from "./reviews-client";

/** 個別銘柄ページに埋め込むAI総評。未生成ならその場で生成できる。 */
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

  return (
    <div id="ai-review" className="space-y-2 scroll-mt-6">
      <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">AI総評 (直近ニュースを踏まえた評価・自分用)</h2>
      {!configured ? (
        <Card>
          <CardContent className="py-4 text-sm text-amber-700 dark:text-amber-400">
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.env.local</code> に
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GEMINI_API_KEY</code> を設定すると使えます。
          </CardContent>
        </Card>
      ) : (
        <ReviewCard item={item} busy={busy} disabled={busy} onRegenerate={generate} />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {busy && <p className="text-sm text-slate-500 dark:text-slate-400">生成中… 20〜60秒ほどかかります。</p>}
    </div>
  );
}
