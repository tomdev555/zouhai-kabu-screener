import { loadScreeningSnapshot } from "@/lib/static-data";
import { WatchlistClient } from "@/components/screener/watchlist-client";

export default async function WatchlistPage() {
  const snapshot = await loadScreeningSnapshot();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">ウォッチリスト</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          気になる銘柄をブックマークしておくリストです。お使いのブラウザ内にのみ保存されます。
        </p>
      </div>

      <WatchlistClient stocks={snapshot.results} />
    </div>
  );
}
