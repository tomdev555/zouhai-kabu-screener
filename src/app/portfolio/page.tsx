import { loadScreeningSnapshot } from "@/lib/static-data";
import { PortfolioClient } from "@/components/portfolio/portfolio-client";

export default async function PortfolioPage() {
  const snapshot = await loadScreeningSnapshot();

  const stocks = snapshot.results.map((r) => ({
    code: r.code,
    name: r.name,
    currentPrice: r.currentPrice,
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">運用実績 (手動トラッキング)</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          保有株を手動で登録し、評価損益・受取配当を管理します。入力内容はお使いのブラウザ内にのみ保存されます。
        </p>
      </div>

      <PortfolioClient stocks={stocks} />
    </div>
  );
}
