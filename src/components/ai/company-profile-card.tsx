// 四季報風の会社概要の表示用カード。公開サイト(JSON由来)と個人モード(DB由来)の両方で使う。

import { Building2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { CompanyProfileContent } from "@/lib/ai/schemas";

export interface CompanyProfileCardProps {
  profile: CompanyProfileContent | null;
  generatedAt?: string | null;
  model?: string | null;
  /** 未生成のときに出す説明 */
  emptyText?: string;
  /** 右上に出す操作 (再生成ボタンなど)。公開サイトでは渡さない */
  action?: React.ReactNode;
}

export function CompanyProfileCard({ profile: p, generatedAt, model, emptyText, action }: CompanyProfileCardProps) {
  return (
    <Card id="profile" className="scroll-mt-6">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Building2 className="size-4" /> 会社概要 (AI整理・四季報風)
          </div>
          {p && <p className="mt-1 text-base font-semibold leading-snug text-slate-900 dark:text-slate-100">【特色】{p.tokushoku}</p>}
          {generatedAt && (
            <p className="mt-1 text-xs text-slate-400">
              {new Date(generatedAt).toLocaleDateString("ja-JP")} 生成{model ? ` ・ ${model}` : ""} ・ 公開情報をAIが整理したもので、正確性は保証されません
            </p>
          )}
        </div>
        {action}
      </CardHeader>

      {!p ? (
        <CardContent className="text-sm text-slate-400">{emptyText ?? "まだ生成されていません"}</CardContent>
      ) : (
        <CardContent className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
            <div className="space-y-5">
              <Section title="事業内容">
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{p.business}</p>
                {p.segments.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {p.segments.map((s, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="shrink-0 font-medium text-slate-800 dark:text-slate-100">{s.name}</span>
                        <span className="text-slate-600 dark:text-slate-300">{s.note}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
              <Section title="沿革">
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{p.history}</p>
              </Section>
              <div className="grid gap-5 sm:grid-cols-2">
                <Section title="強み・競争優位">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
                    {p.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </Section>
                <Section title="主な顧客・市場">
                  <p className="text-sm text-slate-700 dark:text-slate-200">{p.customersMarkets}</p>
                </Section>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Section title="業績の傾向">
                  <p className="text-sm text-slate-700 dark:text-slate-200">{p.performanceTrend}</p>
                </Section>
                <Section title="株主還元">
                  <p className="text-sm text-slate-700 dark:text-slate-200">{p.shareholderReturn}</p>
                </Section>
              </div>
              {p.watchPoints.length > 0 && (
                <Section title="注目点">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-200">
                    {p.watchPoints.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </Section>
              )}
            </div>

            <aside className="rounded-lg border border-slate-100 p-3 text-sm dark:border-slate-800">
              <dl className="space-y-2">
                <Row label="業種">{p.basics.industry}</Row>
                <Row label="本社">{p.basics.headquarters}</Row>
                <Row label="従業員">{p.basics.employees}</Row>
                <Row label="時価総額">{p.basics.marketCap}</Row>
                {p.basics.website && (
                  <Row label="サイト">
                    <a href={p.basics.website} target="_blank" rel="noreferrer" className="text-emerald-800 hover:underline dark:text-emerald-400">
                      {p.basics.website.replace(/^https?:\/\//, "").replace(/\/$/, "")} <ExternalLink className="inline size-3" />
                    </a>
                  </Row>
                )}
                {p.basics.officers.length > 0 && (
                  <Row label="役員">
                    <ul className="space-y-0.5">{p.basics.officers.map((o, i) => <li key={i}>{o}</li>)}</ul>
                  </Row>
                )}
              </dl>
            </aside>
          </div>

          {p.uncertainties.length > 0 && (
            <p className="text-xs text-slate-400">確信が持てない項目: {p.uncertainties.join(" / ")}</p>
          )}
        </CardContent>
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[64px_1fr] gap-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-slate-700 dark:text-slate-200 break-words">{children}</dd>
    </div>
  );
}
