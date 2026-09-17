import { prisma } from "@/lib/db";
import { computePortfolio, loadDividends, loadTrades } from "@/lib/personal/positions";
import { MyPortfolio } from "@/components/personal/my-portfolio";

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const [portfolio, trades, dividends, stocks] = await Promise.all([
    computePortfolio(),
    loadTrades(),
    loadDividends(),
    prisma.stock.findMany({ select: { code: true, name: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">マイポートフォリオ</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          取引を1件ずつ記録すると、保有数・平均取得単価・評価損益・実現損益・受取配当を自動で計算します。
          このPCのデータベースにだけ保存されます。
        </p>
      </div>

      <MyPortfolio portfolio={portfolio} trades={trades} dividends={dividends} stocks={stocks} />
    </div>
  );
}
