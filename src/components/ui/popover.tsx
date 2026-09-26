"use client";

// クリックで開く小さな吹き出し。表の中の「悪い数値」に理由を出すために使う。
// ホバーだけだとスマートフォンで開けないため、クリック(タップ)で開閉する。

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function Popover({
  trigger,
  children,
  align = "right",
  label,
}: {
  /** 吹き出しを開くボタンの中身 */
  trigger: React.ReactNode;
  children: React.ReactNode;
  /** 吹き出しを右端に合わせるか左端に合わせるか */
  align?: "left" | "right";
  /** ボタンの説明 (アイコンだけのときに読み上げで使う) */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
      >
        {trigger}
      </button>
      {open && (
        <span
          id={panelId}
          role="dialog"
          className={cn(
            "absolute z-30 mt-1 block w-72 rounded-md border border-slate-200 bg-white p-3 text-left text-xs font-normal leading-relaxed text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {children}
        </span>
      )}
    </span>
  );
}
