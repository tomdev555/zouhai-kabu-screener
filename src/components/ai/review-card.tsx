// AI総評の表示用カード。公開サイト(JSON由来)と個人モード(DB由来)の両方で使う。
// 生成機能は持たない。操作ボタンは action として外から渡す。

import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Review } from "@/lib/ai/schemas";

export interface ReviewCardProps {
  code: string;
  name: string;
  rank?: number | null;
  review: Review | null;
  generatedAt?: string | null;
  model?: string | null;
  /** 未生成のときに出す説明 */
  emptyText?: string;
  /** 右上に出す操作 (再生成ボタンなど)。公開サイトでは渡さない */
  action?: React.ReactNode;
  /** 構造化できなかったときの生テキスト */
  rawText?: string | null;
  /** 社名リンク先。未指定なら銘柄ページ */
  nameHref?: string;
  /** ページ内リンク用のid。一覧で複数並べるときは付けない */
  anchorId?: string;
  /** 生成後に順位が変わり、現在は上位50社に入っていない */
  outOfRanking?: boolean;
}

export function ReviewCard({
  code,
  name,
  rank = null,
  review: r,
  generatedAt,
  model,
  emptyText = "まだ生成されていません",
  action,
  rawText,
  nameHref,
  anchorId,
  outOfRanking = false,
}: ReviewCardProps) {
  const generatedLabel = generatedAt ? new Date(generatedAt).toLocaleString("ja-JP") : null;

  return (
    <Card id={anchorId} className="scroll-mt-6">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {rank !== null && <span className="text-xs text-slate-400">#{rank}</span>}
            {outOfRanking && <Badge variant="outline">現在は50位圏外</Badge>}
            <Link href={nameHref ?? `/stocks/${code}`} className="text-base font-semibold text-slate-900 hover:underline dark:text-slate-100">
              {name}
            </Link>
            <span className="text-xs text-slate-400">{code}</span>
            {r && <StanceBadge stance={r.stance} />}
            {r && (
              <Badge variant="outline">
                自信度 {r.confidence === "high" ? "高" : r.confidence === "medium" ? "中" : "低"}
              </Badge>
            )}
          </div>
          {r && <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">{r.headline}</p>}
          {generatedLabel && (
            <p className="mt-1 text-xs text-slate-400">
              {generatedLabel} 生成{model ? ` ・ ${model}` : ""} ・ AIによる情報整理であり投資助言ではありません
            </p>
          )}
        </div>
        {action}
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
      ) : rawText ? (
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-4" /> 構造化できなかったため生の応答を表示しています
          </div>
          <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs dark:bg-slate-950">{rawText}</pre>
        </CardContent>
      ) : (
        <CardContent className="text-sm text-slate-400">{emptyText}</CardContent>
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

export function StanceBadge({ stance }: { stance: string }) {
  const variant =
    stance === "候補として有力" ? "success" : stance === "条件付きで検討" ? "warning" : stance === "見送り" ? "danger" : "default";
  return <Badge variant={variant}>{stance}</Badge>;
}

function SeverityBadge({ severity }: { severity: "high" | "medium" | "low" }) {
  const map = { high: ["danger", "高"], medium: ["warning", "中"], low: ["default", "低"] } as const;
  const [variant, label] = map[severity];
  return <Badge variant={variant}>{label}</Badge>;
}
