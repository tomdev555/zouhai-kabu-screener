"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, Star } from "lucide-react";
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
import type { StockScreeningResult } from "@/lib/screening/types";

type SortKey = "rank" | "compositeScore" | "dividendYield" | "epsScore" | "cutFreeYears" | "financialHealth" | "per" | "cash";

/** 自己資本比率(高いほど良い) と D/E比率(低いほど良い) のどちらでも読めるように整形する */
function formatFinancialHealth(health: StockScreeningResult["breakdown"]["financialHealth"]): string {
  if (health.value === null) return "-";
  if (health.metric === "equityRatio") return formatPercent(health.value);
  return `D/E ${formatPercent(health.value)}`;
}

export function ScreenerTable({
  results,
  reviewedCodes = [],
}: {
  results: StockScreeningResult[];
  reviewedCodes?: string[];
}) {
  const reviewed = useMemo(() => new Set(reviewedCodes), [reviewedCodes]);
  const [query, setQuery] = useState("");
  const [onlyPassed, setOnlyPassed] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const { value: watchedCodes, setValue: setWatchedCodes } = useLocalStorage<string[]>(WATCHLIST_KEY, []);
  const watched = useMemo(() => new Set(watchedCodes), [watchedCodes]);

  const filtered = useMemo(() => {
    let list = results;
    if (onlyPassed) list = list.filter((r) => r.rank !== null);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (r) => r.code.includes(q) || r.name.toLowerCase().includes(q) || (r.sector ?? "").toLowerCase().includes(q)
      );
    }
    const sorted = [...list].sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      return vb - va;
    });
    return sorted;
  }, [results, onlyPassed, query, sortKey]);

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
          variant={onlyPassed ? "default" : "outline"}
          size="sm"
          onClick={() => setOnlyPassed((v) => !v)}
        >
          {onlyPassed ? `上位${results.filter((r) => r.rank !== null).length}社のみ表示中` : "全銘柄表示中"}
        </Button>
        <select
          className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          <option value="rank">総合スコアで並び替え</option>
          <option value="dividendYield">配当利回りで並び替え</option>
          <option value="epsScore">EPS成長性で並び替え</option>
          <option value="cutFreeYears">減配なし年数で並び替え</option>
          <option value="financialHealth">財務健全性で並び替え</option>
          <option value="per">PERが低い順</option>
          <option value="cash">現金比率が高い順</option>
        </select>
      </div>

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
              <TableHead className="text-right">財務健全性</TableHead>
              <TableHead className="text-right">PER</TableHead>
              <TableHead className="text-right">現金/時価</TableHead>
              <TableHead className="text-right">総合スコア</TableHead>
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
                  {reviewed.has(r.code) && (
                    <Link
                      href={`/my/reviews/${r.code}`}
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
                <TableCell>
                  {r.passedAllRules ? (
                    <Badge variant="success">条件クリア</Badge>
                  ) : (
                    <Badge variant="outline">基準未達</Badge>
                  )}
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
  }
}
