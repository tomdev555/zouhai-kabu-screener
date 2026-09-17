// 個人モード専用: 取引台帳(Trade)からポジションを計算する。
// 取得単価は移動平均法 (買うたびに平均を更新、売っても平均は変わらない)。

import { prisma } from "../db";

export interface TradeView {
  id: number;
  stockCode: string;
  stockName: string;
  side: "BUY" | "SELL";
  tradeDate: string;
  quantity: number;
  price: number;
  fee: number;
  accountName: string | null;
  note: string | null;
}

export interface DividendView {
  id: number;
  stockCode: string;
  stockName: string;
  paidDate: string;
  amountPerShare: number;
  quantity: number;
  totalAmount: number;
  note: string | null;
}

export interface Position {
  stockCode: string;
  stockName: string;
  sector: string | null;
  quantity: number; // 現在の保有数
  averageCost: number; // 平均取得単価 (手数料込み)
  costBasis: number; // 取得金額合計 = quantity × averageCost
  currentPrice: number | null;
  marketValue: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPct: number | null;
  realizedPnl: number; // 売却で確定した損益の累計 (手数料控除後)
  dividendReceived: number; // 受取配当の累計
  totalReturn: number | null; // 評価損益 + 実現損益 + 配当
  firstTradeDate: string;
  tradeCount: number;
}

export interface PortfolioSummary {
  positions: Position[];
  totalCostBasis: number;
  totalMarketValue: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  totalDividend: number;
  totalReturn: number;
}

function toDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function loadTrades(): Promise<TradeView[]> {
  const trades = await prisma.trade.findMany({
    include: { stock: { select: { name: true } } },
    orderBy: [{ tradeDate: "desc" }, { id: "desc" }],
  });
  return trades.map((t) => ({
    id: t.id,
    stockCode: t.stockCode,
    stockName: t.stock.name,
    side: t.side as "BUY" | "SELL",
    tradeDate: toDate(t.tradeDate),
    quantity: t.quantity,
    price: Number(t.price),
    fee: Number(t.fee),
    accountName: t.accountName,
    note: t.note,
  }));
}

export async function loadDividends(): Promise<DividendView[]> {
  const rows = await prisma.dividendReceipt.findMany({
    include: { stock: { select: { name: true } } },
    orderBy: [{ paidDate: "desc" }, { id: "desc" }],
  });
  return rows.map((d) => ({
    id: d.id,
    stockCode: d.stockCode,
    stockName: d.stock.name,
    paidDate: toDate(d.paidDate),
    amountPerShare: Number(d.amountPerShare),
    quantity: d.quantity,
    totalAmount: Number(d.totalAmount),
    note: d.note,
  }));
}

/**
 * 全取引を時系列に流して、銘柄ごとの保有数・平均取得単価・実現損益を求める。
 * 平均取得単価には買付手数料を含める。売却時は (売値 − 平均取得単価) × 数量 − 売却手数料 を実現損益とする。
 */
export async function computePortfolio(): Promise<PortfolioSummary> {
  const [trades, dividends] = await Promise.all([
    prisma.trade.findMany({
      include: { stock: { select: { name: true, sector33: true, currentPrice: true } } },
      orderBy: [{ tradeDate: "asc" }, { id: "asc" }],
    }),
    prisma.dividendReceipt.groupBy({
      by: ["stockCode"],
      _sum: { totalAmount: true },
    }),
  ]);

  const dividendByCode = new Map(dividends.map((d) => [d.stockCode, Number(d._sum.totalAmount ?? 0)]));

  interface Acc {
    stockName: string;
    sector: string | null;
    currentPrice: number | null;
    quantity: number;
    averageCost: number;
    realizedPnl: number;
    firstTradeDate: string;
    tradeCount: number;
  }
  const acc = new Map<string, Acc>();

  for (const t of trades) {
    const price = Number(t.price);
    const fee = Number(t.fee);
    let a = acc.get(t.stockCode);
    if (!a) {
      a = {
        stockName: t.stock.name,
        sector: t.stock.sector33,
        currentPrice: t.stock.currentPrice ? Number(t.stock.currentPrice) : null,
        quantity: 0,
        averageCost: 0,
        realizedPnl: 0,
        firstTradeDate: toDate(t.tradeDate),
        tradeCount: 0,
      };
      acc.set(t.stockCode, a);
    }
    a.tradeCount++;

    if (t.side === "BUY") {
      const totalCost = a.averageCost * a.quantity + price * t.quantity + fee;
      a.quantity += t.quantity;
      a.averageCost = a.quantity > 0 ? totalCost / a.quantity : 0;
    } else {
      const sellQty = Math.min(t.quantity, a.quantity);
      a.realizedPnl += (price - a.averageCost) * sellQty - fee;
      a.quantity -= sellQty;
      if (a.quantity === 0) a.averageCost = 0;
    }
  }

  const positions: Position[] = [];
  for (const [stockCode, a] of acc.entries()) {
    const costBasis = a.averageCost * a.quantity;
    const marketValue = a.currentPrice !== null && a.quantity > 0 ? a.currentPrice * a.quantity : null;
    const unrealized = marketValue !== null ? marketValue - costBasis : null;
    const dividend = dividendByCode.get(stockCode) ?? 0;
    positions.push({
      stockCode,
      stockName: a.stockName,
      sector: a.sector,
      quantity: a.quantity,
      averageCost: round(a.averageCost, 2),
      costBasis: round(costBasis),
      currentPrice: a.currentPrice,
      marketValue: marketValue !== null ? round(marketValue) : null,
      unrealizedPnl: unrealized !== null ? round(unrealized) : null,
      unrealizedPnlPct: unrealized !== null && costBasis > 0 ? round((unrealized / costBasis) * 100, 2) : null,
      realizedPnl: round(a.realizedPnl),
      dividendReceived: round(dividend),
      totalReturn: round((unrealized ?? 0) + a.realizedPnl + dividend),
      firstTradeDate: a.firstTradeDate,
      tradeCount: a.tradeCount,
    });
  }

  // 保有中を上に、その中では評価額の大きい順
  positions.sort((x, y) => {
    if ((x.quantity > 0) !== (y.quantity > 0)) return x.quantity > 0 ? -1 : 1;
    return (y.marketValue ?? 0) - (x.marketValue ?? 0);
  });

  const open = positions.filter((p) => p.quantity > 0);
  const totalCostBasis = round(open.reduce((s, p) => s + p.costBasis, 0));
  const totalMarketValue = round(open.reduce((s, p) => s + (p.marketValue ?? p.costBasis), 0));
  const totalRealizedPnl = round(positions.reduce((s, p) => s + p.realizedPnl, 0));
  const totalDividend = round(positions.reduce((s, p) => s + p.dividendReceived, 0));
  const totalUnrealizedPnl = round(totalMarketValue - totalCostBasis);

  return {
    positions,
    totalCostBasis,
    totalMarketValue,
    totalUnrealizedPnl,
    totalRealizedPnl,
    totalDividend,
    totalReturn: round(totalUnrealizedPnl + totalRealizedPnl + totalDividend),
  };
}

function round(n: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
