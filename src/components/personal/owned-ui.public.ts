// 公開ビルド用のスタブ。next.config.ts で owned-ui.tsx の代わりに解決され、
// 保有銘柄まわりのUI (「保有中のみ」などの文字列を含む) が公開サイトに入らないようにする。

export interface OwnedPosition {
  code: string;
  quantity: number;
  averageCost: number;
  unrealizedPnlPct: number | null;
}

export const OwnedBadge = null;
export const OwnedFilterButton = null;
export const OwnedHoldingBadge = null;
