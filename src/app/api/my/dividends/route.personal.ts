import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadDividends } from "@/lib/personal/positions";

export async function GET() {
  return NextResponse.json(await loadDividends());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, paidDate, amountPerShare, quantity, totalAmount, note } = body;

  if (!code || !paidDate || !quantity || totalAmount === undefined || totalAmount === "") {
    return NextResponse.json({ error: "銘柄コード・受取日・数量・受取額は必須です" }, { status: 400 });
  }

  const stock = await prisma.stock.findUnique({ where: { code: String(code) } });
  if (!stock) {
    return NextResponse.json({ error: `銘柄コード ${code} がデータベースにありません` }, { status: 400 });
  }

  const qty = Number(quantity);
  const total = Number(totalAmount);
  const perShare = amountPerShare !== undefined && amountPerShare !== "" ? Number(amountPerShare) : total / qty;

  const receipt = await prisma.dividendReceipt.create({
    data: {
      stockCode: String(code),
      paidDate: new Date(paidDate),
      amountPerShare: perShare,
      quantity: qty,
      totalAmount: total,
      note: note ? String(note) : null,
    },
  });
  return NextResponse.json({ id: receipt.id });
}
