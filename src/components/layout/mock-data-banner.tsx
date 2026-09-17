export function MockDataBanner({ isMock }: { isMock: boolean }) {
  if (!isMock) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
      現在モックデータで動作中です。表示されている銘柄・数値はすべて架空のデモデータであり、実際の投資判断には使用できません。
      本番データを使うには設定ページでJ-Quants APIキーを登録してください。
    </div>
  );
}
