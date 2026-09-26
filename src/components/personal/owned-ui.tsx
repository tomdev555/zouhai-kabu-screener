"use client";

// 保有銘柄まわりの表示 (個人モードのみ)。
// 公開ビルドでは next.config.ts の resolveAlias で owned-ui.public.ts に差し替えられ、
// ここの文字列もコードも一切バンドルされない。

import Link from "next/link";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface OwnedPosition {
  code: string;
  quantity: number;
  averageCost: number;
  unrealizedPnlPct: number | null;
}

/** 一覧の社名の横に付ける、実際に買った銘柄の印 */
export function OwnedBadge({ position }: { position: OwnedPosition }) {
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

/** 保有している銘柄だけに絞り込むボタン */
export function OwnedFilterButton({
  count,
  active,
  onClick,
}: {
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  if (count === 0) return null;
  return (
    <Button variant={active ? "default" : "outline"} size="sm" onClick={onClick}>
      <Wallet className="size-3.5" />
      保有中のみ ({count})
    </Button>
  );
}

/** 銘柄ページの見出しに出す保有状況 */
export function OwnedHoldingBadge({ position }: { position: OwnedPosition }) {
  const pnl = position.unrealizedPnlPct;
  return (
    <Link
      href="/my"
      title={`平均取得単価 ${Math.round(position.averageCost).toLocaleString()}円`}
      className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60"
    >
      <Wallet className="size-4" />
      保有中 {position.quantity.toLocaleString()}株
      {pnl !== null && (
        <span
          className={cn(
            pnl >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
          )}
        >
          {pnl >= 0 ? "+" : ""}
          {pnl}%
        </span>
      )}
    </Link>
  );
}
