// JPX(日本取引所グループ)が公開している「東証上場銘柄一覧」から銘柄マスタを取得する。
// https://www.jpx.co.jp/markets/statistics-equities/misc/01.html で公開されている
// Excelファイルを直接ダウンロードするだけなので、APIキーや利用登録は一切不要。

import ExcelJS from "exceljs";
import type { StockMasterRecord } from "./types";

const LISTING_URL =
  "https://www.jpx.co.jp/markets/statistics-equities/misc/tvdivq0000001vg2-att/data_j.xlsx";

// ETF・REIT・優先株などを除き、普通株が上場している市場区分だけを対象にする
const STOCK_MARKETS = ["プライム", "スタンダード", "グロース"];

export interface JpxListedStock extends StockMasterRecord {
  market: string;
}

export async function fetchJpxListedStocks(): Promise<JpxListedStock[]> {
  const res = await fetch(LISTING_URL, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) {
    throw new Error(`JPX銘柄一覧のダウンロードに失敗しました: HTTP ${res.status}`);
  }

  const buffer = await res.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("JPX銘柄一覧のシートが読み取れませんでした");

  // 1行目がヘッダー。列名で位置を特定する(列順の変更に強くするため)。
  const header = sheet.getRow(1).values as (string | undefined)[];
  const col = (name: string) => header.findIndex((h) => typeof h === "string" && h.includes(name));

  const codeCol = col("コード");
  const nameCol = col("銘柄名");
  const marketCol = col("市場・商品区分");
  const sector33Col = col("33業種区分");
  const sector17Col = col("17業種区分");

  if (codeCol < 0 || nameCol < 0 || marketCol < 0) {
    throw new Error("JPX銘柄一覧の列構成が想定と異なります");
  }

  const stocks: JpxListedStock[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values as (string | number | undefined)[];

    const code = String(values[codeCol] ?? "").trim();
    const name = String(values[nameCol] ?? "").trim();
    const market = String(values[marketCol] ?? "").trim();
    if (!code || !name) return;
    if (!STOCK_MARKETS.some((m) => market.includes(m))) return;

    stocks.push({
      code,
      name,
      market,
      sector33: cleanSector(values[sector33Col]),
      sector17: cleanSector(values[sector17Col]),
    });
  });

  return stocks;
}

function cleanSector(value: string | number | undefined): string | undefined {
  const s = String(value ?? "").trim();
  return s && s !== "-" ? s : undefined;
}
