"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WatchButton } from "@/components/screener/watch-button";
import { useLocalStorage } from "@/lib/use-local-storage";
import { WATCHLIST_KEY } from "@/lib/storage-keys";
import { formatPercent, formatYen } from "@/lib/utils";
import type { StockScreeningResult } from "@/lib/screening/types";

export function WatchlistClient({ stocks }: { stocks: StockScreeningResult[] }) {
  const { value: codes, loaded } = useLocalStorage<string[]>(WATCHLIST_KEY, []);
  const watched = stocks.filter((s) => codes.includes(s.code));

  if (!loaded) return null;

  if (watched.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        まだ銘柄が登録されていません。スクリーニング一覧の★アイコンから追加できます。
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {watched.map((s) => (
        <Card key={s.code}>
          <CardHeader>
            <CardTitle className="text-base font-medium text-slate-900 dark:text-slate-100">
              <Link href={`/stocks/${s.code}`} className="hover:underline">
                {s.name}
              </Link>
            </CardTitle>
            <p className="text-xs text-slate-400">
              {s.code} ・ 配当利回り {formatPercent(s.breakdown.dividendYield.value)} ・ 減配なし
              {s.breakdown.dividendCutFree.years}年
            </p>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-lg font-semibold">{formatYen(s.currentPrice)}</span>
            <WatchButton code={s.code} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
