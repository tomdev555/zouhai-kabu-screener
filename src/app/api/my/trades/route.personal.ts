import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadTrades } from "@/lib/personal/positions";

export async function GET() {
  return NextResponse.json(await loadTrades());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, side, tradeDate, quantity, price, fee, accountName, note } = body;

  if (!code || !tradeDate || !quantity || price === undefined || price === "") {
    return NextResponse.json({ error: "銘柄コード・約定日・数量・単価は必須です" }, { status: 400 });
  }
  if (side !== "BUY" && side !== "SELL") {
    return NextResponse.json({ error: "side は BUY か SELL を指定してください" }, { status: 400 });
  }

  const stock = await prisma.stock.findUnique({ where: { code: String(code) } });
  if (!stock) {
    return NextResponse.json(
      { error: `銘柄コード ${code} がデータベースにありません。npm run refresh で銘柄データを取得してください` },
      { status: 400 }
    );
  }

  const trade = await prisma.trade.create({
    data: {
      stockCode: String(code),
      side,
      tradeDate: new Date(tradeDate),
      quantity: Number(quantity),
      price: Number(price),
      fee: Number(fee ?? 0),
      accountName: accountName ? String(accountName) : null,
      note: note ? String(note) : null,
    },
  });
  return NextResponse.json({ id: trade.id });
}
