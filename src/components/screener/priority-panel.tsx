"use client";

// 閲覧者が「何を重視するか」を自分で決めるパネル。
// 決めた重みはブラウザに保存し、一覧の「マイスコア」と並び替えに使う。

import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FACTORS, type FactorKey } from "@/lib/screening/factors";

/** 0(使わない) 〜 5(最重視) の6段階。総合スコアの重みはこの比率で正規化する */
export const PRIORITY_LEVELS = [0, 1, 2, 3, 4, 5] as const;

const LEVEL_LABEL: Record<number, string> = {
  0: "使わない",
  1: "ごく軽く",
  2: "軽く",
  3: "ふつう",
  4: "重視",
  5: "最重視",
};

export type Priorities = Record<FactorKey, number>;

/** 既定の重み(合計1.0)を0〜5の段階に直したもの。初期表示とリセットに使う */
export const DEFAULT_PRIORITIES: Priorities = Object.fromEntries(
  FACTORS.map((f) => [f.key, Math.max(1, Math.round(f.defaultWeight * 20))])
) as Priorities;

export function PriorityPanel({
  priorities,
  onChange,
  onReset,
  onClose,
}: {
  priorities: Priorities;
  onChange: (key: FactorKey, level: number) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="size-4" />
            自分の優先順位でスコアを付け直す
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            重視したい項目を上げると「マイスコア」が変わります。並び替えで「マイスコア順」を選ぶと反映されます。
            設定はこのブラウザにだけ保存されます。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="size-3.5" />
            既定に戻す
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {FACTORS.map((f) => {
          const level = priorities[f.key] ?? 0;
          return (
            <div key={f.key} className="flex items-center gap-3">
              <label htmlFor={`priority-${f.key}`} className="w-28 shrink-0 text-sm">
                {f.label}
              </label>
              <input
                id={`priority-${f.key}`}
                type="range"
                min={0}
                max={5}
                step={1}
                value={level}
                onChange={(e) => onChange(f.key, Number(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer accent-emerald-700"
              />
              <span
                className={`w-16 shrink-0 text-right text-xs ${
                  level === 0 ? "text-slate-400" : "text-slate-600 dark:text-slate-300"
                }`}
              >
                {LEVEL_LABEL[level]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
