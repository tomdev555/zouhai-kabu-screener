"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { StoredReview } from "@/lib/personal/ai-review";

interface Item {
  code: string;
  name: string;
  rank: number;
  review: StoredReview | null;
}

export function ReviewsClient({ items, configured }: { items: Item[]; configured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null); // "all" | code
  const [message, setMessage] = useState<string | null>(null);

  async function generate(body: Record<string, unknown>, label: string) {
    setBusy(label);
    setMessage(label === "all" ? "生成中… 1銘柄あたり30秒〜1分程度、無料枠の制限に合わせて間隔を空けて実行します。このページを開いたままお待ちください。" : "生成中…");
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
      if (json.failed?.length) parts.push(`失敗 ${json.failed.length}件 (${json.failed.map((f: { code: string; error: string }) => `${f.code}: ${f.error}`).join(" / ")})`);
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
            item={item}
            busy={busy === item.code}
            disabled={!configured || busy !== null}
            onRegenerate={() => generate({ code: item.code }, item.code)}
          />
        ))}
      </div>
    </div>
  );
}

function ReviewCard({
  item,
  busy,
  disabled,
  onRegenerate,
}: {
  item: Item;
  busy: boolean;
  disabled: boolean;
  onRegenerate: () => void;
}) {
  const r = item.review?.review ?? null;
  const generatedAt = item.review ? new Date(item.review.generatedAt).toLocaleString("ja-JP") : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">#{item.rank}</span>
            <Link href={`/stocks/${item.code}`} className="text-base font-semibold text-slate-900 hover:underline dark:text-slate-100">
              {item.name}
            </Link>
            <span className="text-xs text-slate-400">{item.code}</span>
            {r && <StanceBadge stance={r.stance} />}
            {r && (
              <Badge variant="outline">
                自信度 {r.confidence === "high" ? "高" : r.confidence === "medium" ? "中" : "低"}
              </Badge>
            )}
          </div>
          {r && <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">{r.headline}</p>}
          {generatedAt && (
            <p className="mt-1 text-xs text-slate-400">
              {generatedAt} 生成 ・ {item.review?.model}
              {item.review?.inputTokens ? ` ・ ${((item.review.inputTokens + (item.review.outputTokens ?? 0)) / 1000).toFixed(0)}K tokens` : ""}
            </p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={onRegenerate} disabled={disabled}>
          <RefreshCw className={busy ? "animate-spin" : ""} />
          {r ? "再生成" : "生成"}
        </Button>
      </CardHeader>

      {r ? (
        <CardContent className="space-y-5">
          <Section title="総評">
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{r.summary}</p>
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="強み・安心材料">
              <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                {r.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-emerald-600">✓</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="スクリーニングでは見えないリスク">
              {r.hiddenRisks.length === 0 ? (
                <p className="text-sm text-slate-400">特筆すべきリスクは見つかりませんでした</p>
              ) : (
                <ul className="space-y-2">
                  {r.hiddenRisks.map((risk, i) => (
                    <li key={i} className="rounded-md border border-slate-100 p-2 text-sm dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={risk.severity} />
                        <span className="font-medium text-slate-800 dark:text-slate-100">{risk.title}</span>
                      </div>
                      <p className="mt-1 text-slate-600 dark:text-slate-300">{risk.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          {r.recentNews.length > 0 && (
            <Section title="最近のニュース・開示">
              <ul className="space-y-2">
                {r.recentNews.map((n, i) => (
                  <li key={i} className="text-sm">
                    <div className="flex flex-wrap items-baseline gap-2">
                      {n.date && <span className="text-xs text-slate-400">{n.date}</span>}
                      {n.url ? (
                        <a href={n.url} target="_blank" rel="noreferrer" className="font-medium text-emerald-800 hover:underline dark:text-emerald-400">
                          {n.title} <ExternalLink className="inline size-3" />
                        </a>
                      ) : (
                        <span className="font-medium text-slate-800 dark:text-slate-100">{n.title}</span>
                      )}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">→ {n.takeaway}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="買う前に確認すること">
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
                {r.checkpoints.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </Section>
            <Section title="スタンスの理由">
              <p className="text-sm text-slate-700 dark:text-slate-200">{r.stanceReason}</p>
            </Section>
          </div>

          {r.sources.length > 0 && (
            <details className="text-xs text-slate-500 dark:text-slate-400">
              <summary className="cursor-pointer">出典 ({r.sources.length})</summary>
              <ul className="mt-1 space-y-0.5 pl-4">
                {r.sources.map((s, i) => (
                  <li key={i}>
                    <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">{s.title || s.url}</a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </CardContent>
      ) : item.review?.rawText ? (
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-4" /> 構造化できなかったため生の応答を表示しています
          </div>
          <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs dark:bg-slate-950">{item.review.rawText}</pre>
        </CardContent>
      ) : (
        <CardContent className="text-sm text-slate-400">まだ生成されていません</CardContent>
      )}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
    </div>
  );
}

function StanceBadge({ stance }: { stance: string }) {
  const variant =
    stance === "候補として有力" ? "success" : stance === "条件付きで検討" ? "warning" : stance === "見送り" ? "danger" : "default";
  return <Badge variant={variant}>{stance}</Badge>;
}

function SeverityBadge({ severity }: { severity: "high" | "medium" | "low" }) {
  const map = { high: ["danger", "高"], medium: ["warning", "中"], low: ["default", "低"] } as const;
  const [variant, label] = map[severity];
  return <Badge variant={variant}>{label}</Badge>;
}
