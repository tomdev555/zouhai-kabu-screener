"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  Star,
  Wallet,
  Settings,
  TrendingUp,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "スクリーニング", icon: LayoutGrid },
  { href: "/watchlist", label: "ウォッチリスト", icon: Star },
  { href: "/portfolio", label: "運用実績", icon: Wallet },
  { href: "/settings", label: "このサイトについて", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-slate-200 dark:border-slate-800">
        <TrendingUp className="size-5 text-emerald-700" />
        <span className="font-semibold text-slate-900 dark:text-slate-100">増配株ナビ</span>
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
