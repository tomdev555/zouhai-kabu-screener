"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, SlidersHorizontal, Sparkles, Star, Wallet } from "lucide-react";
import { Popover } from "@/components/ui/popover";
import { DEFAULT_PRIORITIES, PriorityPanel, type Priorities } from "./priority-panel";
import { collectConcerns, weightedScore, type Concern, type FactorKey } from "@/lib/screening/factors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPercent, formatYen, cn } from "@/lib/utils";
import { useLocalStorage } from "@/lib/use-local-storage";
import { WATCHLIST_KEY } from "@/lib/storage-keys";
import type { ScreeningCriteria, StockScreeningResult } from "@/lib/screening/types";

const PRIORITIES_KEY = "zouhai:priorities";

type SortKey =
  | "rank"
  | "compositeScore"
  | "dividendYield"
  | "epsScore"
  | "cutFreeYears"
  | "growthYears"
  | "myScore"
  | "financialHealth"
  | "per"
  | "cash";

/**
 * 「条件クリアだが、この数値は弱い」を出す吹き出し。
 * 総合の判定が良くても、内訳で気になる数値があれば理由を読めるようにする。
 */
function ConcernsPopover({ name, concerns }: { name: string; concerns: Concern[] }) {
  if (concerns.length === 0) return null;
  const blocking = concerns.filter((c) => c.blocking).length;

  return (
    <Popover
      label={`${name}の気になる点を見る`}
      trigger={
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
            blocking > 0
              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
              : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
          )}
        >
          <AlertTriangle className="size-3" />
          {concerns.length}
        </span>
      }
    >
      <p className="mb-2 font-medium text-slate-900 dark:text-slate-100">
        {name} の気になる点 ({concerns.length}件)
      </p>
      <ul className="space-y-2">
        {concerns.map((c) => (
          <li key={c.key}>
            <span
              className={cn(
                "mr-1.5 rounded px-1 py-0.5 text-[10px] font-medium",
                c.blocking
                  ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              )}
            >
              {c.blocking ? "基準未達" : "弱い"}
            </span>
            <span className="font-medium text-slate-800 dark:text-slate-100">{c.label}</span>
            <span className="mt-0.5 block text-slate-600 dark:text-slate-300">{c.reason}</span>
          </li>
        ))}
      </ul>
    </Popover>
  );
}

/**
 * 増収増益の状態を1マスで示す。
 * 連続年数が数えられるときは「3年連続」、崩れているときは何が落ちたかを出す。
 */
function GrowthCell({ momentum: m }: { momentum: StockScreeningResult["breakdown"]["earningsMomentum"] }) {
  if (m.annualDataIssue && m.consecutiveGrowthYears === 0) {
    return (
      <span className="text-slate-400" title={m.annualDataIssue}>
        通期データ不整合
      </span>
    );
  }
  if (m.comparableYears === 0 && m.negatives.length === 0) return <span className="text-slate-400">-</span>;

  if (m.consecutiveGrowthYears > 0) {
    const capped = m.consecutiveGrowthYears >= m.comparableYears;
    return (
      <span
        className="font-medium text-emerald-700 dark:text-emerald-400"
        title={
          capped
            ? `比較できる${m.comparableYears}年すべてで増収増益 (データの保有年数が上限)`
            : `増収${m.consecutiveRevenueGrowthYears}年 / 増益${m.consecutiveProfitGrowthYears}年`
        }
      >
        {m.consecutiveGrowthYears}年連続{capped ? "+" : ""}
      </span>
    );
  }

  const label = m.negatives.some((n) => n.includes("通期が減益"))
    ? "通期減益"
    : m.negatives.some((n) => n.includes("通期が減収"))
      ? "通期減収"
      : m.negatives.length > 0
        ? "直近が減速"
        : "-";
  return (
    <span className="text-amber-700 dark:text-amber-500" title={m.negatives.join(" / ")}>
      {label}
    </span>
  );
}

/** 実際に買った銘柄に付ける印。数量と平均取得単価、含み損益をツールチップに出す */
function OwnedBadge({ position }: { position: OwnedPosition }) {
  const pnl = position.unrealizedPnlPct;
  const title = [
    `保有 ${position.quantity.toLocaleString()}株`,
    `平均取得単価 ${Math.round(position.averageCost).toLocaleString()}円`,
    pnl === null ? null : `評価損益 ${pnl >= 0 ? "+" : ""}${pnl}%`,
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <Link
      href="/my"
      title={title}
      className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60"
    >
      <Wallet className="size-3" /> 保有
    </Link>
  );
}

/** 自己資本比率(高いほど良い) と D/E比率(低いほど良い) のどちらでも読めるように整形する */
function formatFinancialHealth(health: StockScreeningResult["breakdown"]["financialHealth"]): string {
  if (health.value === null) return "-";
  if (health.metric === "equityRatio") return formatPercent(health.value);
  return `D/E ${formatPercent(health.value)}`;
}

export interface OwnedPosition {
  code: string;
  quantity: number;
  averageCost: number;
  unrealizedPnlPct: number | null;
}

export function ScreenerTable({
  results,
  criteria,
  reviewedCodes = [],
  reviewHrefBase = "/ai-reviews/#",
  ownedPositions = [],
}: {
  results: StockScreeningResult[];
  /** 「悪い数値」の理由を組み立てるのに使う判定基準 */
  criteria: ScreeningCriteria;
  reviewedCodes?: string[];
  /** AIバッジのリンク先の前半 (末尾に銘柄コードが付く) */
  reviewHrefBase?: string;
  /** 実際に買って今も持っている銘柄 (個人モードのみ。公開サイトでは常に空) */
  ownedPositions?: OwnedPosition[];
}) {
  const reviewed = useMemo(() => new Set(reviewedCodes), [reviewedCodes]);
  const owned = useMemo(() => new Map(ownedPositions.map((p) => [p.code, p])), [ownedPositions]);
  const [query, setQuery] = useState("");
  const [showPriorities, setShowPriorities] = useState(false);
  const { value: priorities, setValue: setPriorities } = useLocalStorage<Priorities>(
    PRIORITIES_KEY,
    DEFAULT_PRIORITIES
  );
  // 既定と違う重みを付けているときだけ「マイスコア」列を出す
  const customized = useMemo(
    () => Object.entries(DEFAULT_PRIORITIES).some(([k, v]) => (priorities[k as FactorKey] ?? v) !== v),
    [priorities]
  );
  const myScoreOf = useMemo(
    () => (r: StockScreeningResult) => weightedScore(r.breakdown, priorities),
    [priorities]
  );
  const concernsOf = useMemo(
    () => (r: StockScreeningResult) => collectConcerns(r.breakdown, criteria),
    [criteria]
  );
  const [onlyOwned, setOnlyOwned] = useState(false);
  const [onlyPassed, setOnlyPassed] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const { value: watchedCodes, setValue: setWatchedCodes } = useLocalStorage<string[]>(WATCHLIST_KEY, []);
  const watched = useMemo(() => new Set(watchedCodes), [watchedCodes]);

  const filtered = useMemo(() => {
    let list = results;
    if (onlyOwned) list = list.filter((r) => owned.has(r.code));
    else if (onlyPassed) list = list.filter((r) => r.rank !== null);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (r) => r.code.includes(q) || r.name.toLowerCase().includes(q) || (r.sector ?? "").toLowerCase().includes(q)
      );
    }
    const sorted = [...list].sort((a, b) => {
      const va = sortKey === "myScore" ? myScoreOf(a) : sortValue(a, sortKey);
      const vb = sortKey === "myScore" ? myScoreOf(b) : sortValue(b, sortKey);
      return vb - va;
    });
    return sorted;
  }, [results, onlyOwned, onlyPassed, owned, query, sortKey, myScoreOf]);

  function toggleWatch(code: string) {
    setWatchedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="銘柄コード・銘柄名・セクターで検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <Button
          variant={onlyPassed && !onlyOwned ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setOnlyOwned(false);
            setOnlyPassed((v) => !v);
          }}
        >
          {onlyPassed ? `上位${results.filter((r) => r.rank !== null).length}社のみ表示中` : "全銘柄表示中"}
        </Button>
        {ownedPositions.length > 0 && (
          <Button variant={onlyOwned ? "default" : "outline"} size="sm" onClick={() => setOnlyOwned((v) => !v)}>
            <Wallet className="size-3.5" />
            保有中のみ ({ownedPositions.length})
          </Button>
        )}
        <Button
          variant={showPriorities || customized ? "default" : "outline"}
          size="sm"
          onClick={() => setShowPriorities((v) => !v)}
        >
          <SlidersHorizontal className="size-3.5" />
          優先順位{customized ? " (設定中)" : ""}
        </Button>
        <select
          className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          <option value="rank">総合スコアで並び替え</option>
          <option value="myScore">マイスコア (自分の優先順位) で並び替え</option>
          <option value="dividendYield">配当利回りで並び替え</option>
          <option value="epsScore">EPS成長性で並び替え</option>
          <option value="cutFreeYears">減配なし年数で並び替え</option>
          <option value="growthYears">増収増益の連続年数で並び替え</option>
          <option value="financialHealth">財務健全性で並び替え</option>
          <option value="per">PERが低い順</option>
          <option value="cash">現金比率が高い順</option>
        </select>
      </div>

      {showPriorities && (
        <PriorityPanel
          priorities={priorities}
          onChange={(key, level) => setPriorities({ ...priorities, [key]: level })}
          onReset={() => setPriorities(DEFAULT_PRIORITIES)}
          onClose={() => setShowPriorities(false)}
        />
      )}

      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">順位</TableHead>
              <TableHead>銘柄</TableHead>
              <TableHead>セクター</TableHead>
              <TableHead className="text-right">現在値</TableHead>
              <TableHead className="text-right">配当利回り</TableHead>
              <TableHead className="text-right">EPSスコア</TableHead>
              <TableHead className="text-right">減配なし年数</TableHead>
              <TableHead className="text-right">増収増益</TableHead>
              <TableHead className="text-right">財務健全性</TableHead>
              <TableHead className="text-right">PER</TableHead>
              <TableHead className="text-right">現金/時価</TableHead>
              <TableHead className="text-right">総合スコア</TableHead>
              {customized && <TableHead className="text-right">マイスコア</TableHead>}
              <TableHead>判定</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.code}>
                <TableCell className="text-slate-500">{r.rank ?? "-"}</TableCell>
                <TableCell>
                  <Link href={`/stocks/${r.code}`} className="font-medium text-emerald-800 hover:underline dark:text-emerald-400">
                    {r.name}
                  </Link>
                  {owned.has(r.code) && <OwnedBadge position={owned.get(r.code)!} />}
                  {reviewed.has(r.code) && (
                    <Link
                      href={`${reviewHrefBase}${r.code}`}
                      className="ml-2 inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-800 hover:bg-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:hover:bg-violet-900/60"
                      title="AI総評を見る"
                    >
                      <Sparkles className="size-3" /> AI
                    </Link>
                  )}
                  <div className="text-xs text-slate-400">{r.code}</div>
                </TableCell>
                <TableCell className="text-slate-500">{r.sector ?? "-"}</TableCell>
                <TableCell className="text-right">{formatYen(r.currentPrice)}</TableCell>
                <TableCell className="text-right">
                  <RuleCell pass={r.breakdown.dividendYield.pass} value={formatPercent(r.breakdown.dividendYield.value)} />
                  {r.breakdown.dividendYield.basis === "forward" && (
                    <div className="text-[10px] text-slate-400">予想</div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <RuleCell pass={r.breakdown.epsTrend.pass} value={r.breakdown.epsTrend.score.toFixed(0)} />
                </TableCell>
                <TableCell className="text-right">
                  <RuleCell pass={r.breakdown.dividendCutFree.pass} value={`${r.breakdown.dividendCutFree.years}年`} />
                </TableCell>
                <TableCell className="text-right">
                  <GrowthCell momentum={r.breakdown.earningsMomentum} />
                </TableCell>
                <TableCell className="text-right">
                  <RuleCell
                    pass={r.breakdown.financialHealth.pass}
                    value={formatFinancialHealth(r.breakdown.financialHealth)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <span className={perTone(r.breakdown.valuation.per)}>
                    {r.breakdown.valuation.per !== null ? `${r.breakdown.valuation.per.toFixed(1)}倍` : "-"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {r.breakdown.cash.cashToMarketCap !== null ? formatPercent(r.breakdown.cash.cashToMarketCap, 0) : "-"}
                </TableCell>
                <TableCell className="text-right font-medium">{r.compositeScore.toFixed(1)}</TableCell>
                {customized && (
                  <TableCell className="text-right font-medium text-emerald-800 dark:text-emerald-400">
                    {myScoreOf(r).toFixed(1)}
                  </TableCell>
                )}
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    {r.passedAllRules ? (
                      <Badge variant="success">条件クリア</Badge>
                    ) : (
                      <Badge variant="outline">基準未達</Badge>
                    )}
                    <ConcernsPopover name={r.name} concerns={concernsOf(r)} />
                  </span>
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => toggleWatch(r.code)}
                    className="text-slate-400 hover:text-amber-500"
                    aria-label="ウォッチリストに追加"
                  >
                    <Star
                      className={cn("size-4", watched.has(r.code) && "fill-amber-400 text-amber-500")}
                    />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** PERは15倍を基準に、安ければ緑・割高なら赤 */
function perTone(per: number | null): string {
  if (per === null) return "text-slate-400";
  if (per <= 12) return "text-emerald-700 dark:text-emerald-400";
  if (per >= 22) return "text-red-500";
  return "text-slate-700 dark:text-slate-200";
}

function RuleCell({ pass, value }: { pass: boolean; value: string }) {
  return <span className={pass ? "text-slate-700 dark:text-slate-200" : "text-red-500"}>{value}</span>;
}

function sortValue(r: StockScreeningResult, key: SortKey): number {
  switch (key) {
    case "rank":
      return r.compositeScore;
    case "compositeScore":
      return r.compositeScore;
    case "dividendYield":
      return r.breakdown.dividendYield.value ?? -1;
    case "epsScore":
      return r.breakdown.epsTrend.score;
    case "cutFreeYears":
      return r.breakdown.dividendCutFree.years;
    case "growthYears":
      return r.breakdown.earningsMomentum.consecutiveGrowthYears;
    case "financialHealth": {
      const h = r.breakdown.financialHealth;
      if (h.value === null) return -1;
      // D/E比率は低いほど良いので、並び順を揃えるために符号を反転する
      return h.metric === "equityRatio" ? h.value : -h.value;
    }
    case "per":
      // 低いほど良い。未算出(赤字等)は最後に
      return r.breakdown.valuation.per !== null ? -r.breakdown.valuation.per : -Infinity;
    case "cash":
      return r.breakdown.cash.cashToMarketCap ?? -1;
    case "myScore":
      // マイスコアは重みが要るため呼び出し側で計算する
      return r.compositeScore;
  }
}
