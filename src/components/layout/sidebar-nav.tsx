"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutGrid, Star, Settings, TrendingUp, Briefcase, Sparkles, type LucideIcon } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "スクリーニング", icon: LayoutGrid },
  { href: "/ai-reviews", label: "AI総評", icon: Sparkles },
  { href: "/watchlist", label: "ウォッチリスト", icon: Star },
  { href: "/settings", label: "このサイトについて", icon: Settings },
];

// 個人モードのメニューは personal-sections.tsx から渡される (公開ビルドには文字列も含めない)。
// クライアントコンポーネントにはアイコン関数を渡せないため、名前で受け取る
const ICONS: Record<string, LucideIcon> = { sparkles: Sparkles, briefcase: Briefcase };

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
}

export function SidebarNav({ personalItems = [] }: { personalItems?: NavItem[] }) {
  const pathname = usePathname() ?? "";
  const personal = personalItems.length > 0;
  const extraItems = personalItems.map((i) => ({ ...i, icon: ICONS[i.icon] ?? Sparkles }));

  // /my と /my/reviews のように前方一致が重なる場合は、最も長く一致したものだけを選択中にする
  const allItems = personal ? [...NAV_ITEMS, ...extraItems] : NAV_ITEMS;
  const activeHref = allItems
    .filter((i) => (i.href === "/" ? pathname === "/" : pathname === i.href || pathname.startsWith(i.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const renderItem = (item: (typeof NAV_ITEMS)[number]) => {
    const active = item.href === activeHref;
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
  };

  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-slate-200 dark:border-slate-800">
        <TrendingUp className="size-5 text-emerald-700" />
        <span className="font-semibold text-slate-900 dark:text-slate-100">増配株ピックアップMe</span>
      </div>
      <nav className="flex flex-col gap-1 p-3">{NAV_ITEMS.map(renderItem)}</nav>
      {personal && (
        <>
          <div className="px-6 pt-3 pb-1 text-xs font-medium text-slate-400">自分用 (このPCのみ)</div>
          <nav className="flex flex-col gap-1 px-3">{extraItems.map(renderItem)}</nav>
        </>
      )}
    </aside>
  );
}
