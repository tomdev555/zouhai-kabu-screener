// 開発・デモ用のモックデータプロバイダ。
// J-Quants APIキー(JQUANTS_API_KEY)が未設定の場合、アプリはこのプロバイダで動作する。
//
// 重要: ここで生成される銘柄名・コードはすべて架空のものであり、実在企業とは無関係。
// 実際の投資判断には使用しないこと。UI側で「モックデータ」であることを明示する。

import type {
  DataProvider,
  FinancialYearRecord,
  PriceBar,
  StockMasterRecord,
} from "./types";

// 決定論的な疑似乱数生成器 (実行ごとに同じデータになるようにする)
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pattern =
  | "healthy_grower" // 優良増配株: EPS右肩上がり、減配なし、負債少ない
  | "dividend_cut" // 過去に減配あり -> 除外対象
  | "special_dividend_spike" // 特別配当スパイクあり -> 検出対象
  | "high_debt" // 負債過多 -> 除外対象
  | "stagnant_eps"; // EPS成長なし -> 除外対象

const SECTORS = [
  "食品",
  "医薬品",
  "化学",
  "機械",
  "電気機器",
  "情報・通信業",
  "陸運業",
  "小売業",
  "銀行業",
  "卸売業",
  "建設業",
  "サービス業",
];

const NAME_PARTS_A = [
  "サン", "アース", "グリーン", "ノース", "セントラル", "ユニ", "コスモ", "パシフィック",
  "ネオ", "クリスタル", "オリオン", "フロンティア", "アルファ", "テラ", "スター", "リバー",
];
const NAME_PARTS_B = [
  "製薬", "電機", "食品", "化学工業", "商事", "物産", "工業", "システムズ",
  "フーズ", "建設", "重工", "サービス", "ホールディングス", "テクノロジー", "運輸", "銀行",
];

interface MockCompany {
  code: string;
  name: string;
  sector: string;
  pattern: Pattern;
  basePrice: number;
  baseEps: number;
  baseDividend: number;
  epsGrowthRate: number;
  equityRatio: number;
}

const NUM_COMPANIES = 70;
const HISTORY_YEARS = 12;
const CURRENT_YEAR = new Date().getFullYear();

function buildCompanies(): MockCompany[] {
  const rng = mulberry32(20260101);
  const patterns: Pattern[] = [];
  // パターンの内訳: 優良増配 40%, 減配あり 20%, 特別配当スパイク 15%, 高負債 15%, EPS停滞 10%
  const counts: [Pattern, number][] = [
    ["healthy_grower", Math.round(NUM_COMPANIES * 0.4)],
    ["dividend_cut", Math.round(NUM_COMPANIES * 0.2)],
    ["special_dividend_spike", Math.round(NUM_COMPANIES * 0.15)],
    ["high_debt", Math.round(NUM_COMPANIES * 0.15)],
    ["stagnant_eps", Math.round(NUM_COMPANIES * 0.1)],
  ];
  for (const [p, c] of counts) for (let i = 0; i < c; i++) patterns.push(p);
  while (patterns.length < NUM_COMPANIES) patterns.push("healthy_grower");

  const companies: MockCompany[] = [];
  for (let i = 0; i < NUM_COMPANIES; i++) {
    const code = String(3000 + i * 7); // 架空の4桁コード
    const a = NAME_PARTS_A[Math.floor(rng() * NAME_PARTS_A.length)];
    const b = NAME_PARTS_B[Math.floor(rng() * NAME_PARTS_B.length)];
    const name = `${a}${b}(デモ)`;
    const sector = SECTORS[Math.floor(rng() * SECTORS.length)];
    const pattern = patterns[i];

    companies.push({
      code,
      name,
      sector,
      pattern,
      basePrice: 800 + Math.floor(rng() * 4000),
      baseEps: 40 + rng() * 150,
      baseDividend: 20 + rng() * 60,
      epsGrowthRate:
        pattern === "stagnant_eps" ? -0.01 + rng() * 0.02 : 0.03 + rng() * 0.08,
      equityRatio:
        pattern === "high_debt" ? 8 + rng() * 15 : 35 + rng() * 35,
    });
  }
  return companies;
}

const COMPANIES = buildCompanies();

function financialHistoryFor(c: MockCompany): FinancialYearRecord[] {
  const rng = mulberry32(Number(c.code) * 31 + 7);
  const records: FinancialYearRecord[] = [];
  let eps = c.baseEps / Math.pow(1 + c.epsGrowthRate, HISTORY_YEARS);
  let dividend = c.baseDividend / Math.pow(1 + c.epsGrowthRate * 0.8, HISTORY_YEARS);
  // 減配ありパターンで、どの年に減配させるか
  const cutYearIndex = 3 + Math.floor(rng() * (HISTORY_YEARS - 4));
  // 特別配当スパイクを起こす年
  const spikeYearIndex = 4 + Math.floor(rng() * (HISTORY_YEARS - 5));

  for (let i = 0; i < HISTORY_YEARS; i++) {
    const fiscalYear = CURRENT_YEAR - (HISTORY_YEARS - 1 - i);
    const noise = 0.95 + rng() * 0.1;
    eps = Math.max(1, eps * (1 + c.epsGrowthRate) * noise);

    let divThisYear = dividend * (1 + c.epsGrowthRate * 0.8) * (0.97 + rng() * 0.06);

    if (c.pattern === "dividend_cut" && i === cutYearIndex) {
      divThisYear = dividend * 0.6; // 大幅減配
    }
    if (c.pattern === "special_dividend_spike" && i === spikeYearIndex) {
      divThisYear = dividend * 2.4; // 特別配当による一時的な急増(資産売却等)
    }
    dividend = divThisYear;
    if (c.pattern === "special_dividend_spike" && i === spikeYearIndex) {
      // 翌年以降は元の水準(特別配当を除いたベース)に戻す
      dividend = divThisYear / 2.4;
    }

    const totalAssets = eps * 900 + rng() * 5000;
    const netAssets = totalAssets * (c.equityRatio / 100);

    records.push({
      fiscalYear,
      fiscalPeriodEndDate: `${fiscalYear}-03-31`,
      eps: round2(eps),
      bps: round2(netAssets / 1_000_000),
      netSales: round2(eps * 12000 + rng() * 20000),
      operatingProfit: round2(eps * 1600),
      ordinaryProfit: round2(eps * 1550),
      netIncome: round2(eps * 1000),
      totalAssets: round2(totalAssets),
      netAssets: round2(netAssets),
      equityRatio: round2(c.equityRatio + (rng() - 0.5) * 3),
      interestBearingDebt: round2(totalAssets * (1 - c.equityRatio / 100) * 0.4),
      dividendPerShare: round2(divThisYear),
      isForecast: i === HISTORY_YEARS - 1 && rng() > 0.5,
    });
  }
  return records;
}

function priceHistoryFor(c: MockCompany, days = 760): PriceBar[] {
  const rng = mulberry32(Number(c.code) * 17 + 3);
  const bars: PriceBar[] = [];
  let price = c.basePrice * 0.75;
  const drift = c.pattern === "stagnant_eps" ? 0.0001 : 0.00045;
  const today = new Date();

  const rawBars: { date: Date; price: number }[] = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue; // 土日除外
    const shock = (rng() - 0.5) * 0.02;
    price = Math.max(50, price * (1 + drift + shock));
    rawBars.push({ date: d, price });
  }

  for (const { date, price: close } of rawBars) {
    const open = close * (0.995 + rng() * 0.01);
    const high = Math.max(open, close) * (1 + rng() * 0.008);
    const low = Math.min(open, close) * (1 - rng() * 0.008);
    bars.push({
      date: date.toISOString().slice(0, 10),
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
      volume: Math.floor(10000 + rng() * 500000),
    });
  }
  return bars;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export class MockDataProvider implements DataProvider {
  readonly name = "mock";

  async fetchAllStockMaster(): Promise<StockMasterRecord[]> {
    return COMPANIES.map((c) => {
      const prices = priceHistoryFor(c, 5);
      const last = prices[prices.length - 1];
      const financials = financialHistoryFor(c);
      const lastFin = financials[financials.length - 1];
      return {
        code: c.code,
        name: c.name,
        market: "デモ市場",
        sector33: c.sector,
        sector17: c.sector,
        currentPrice: last?.close,
        per: lastFin?.eps ? round2(last.close / lastFin.eps) : undefined,
        pbr: lastFin?.bps ? round2(last.close / (lastFin.bps || 1)) : undefined,
        marketCap: last?.close ? round2(last.close * 1_000_000) : undefined,
      };
    });
  }

  async fetchPriceHistory(code: string): Promise<PriceBar[]> {
    const c = COMPANIES.find((c) => c.code === code);
    if (!c) return [];
    return priceHistoryFor(c);
  }

  async fetchFinancialHistory(code: string): Promise<FinancialYearRecord[]> {
    const c = COMPANIES.find((c) => c.code === code);
    if (!c) return [];
    return financialHistoryFor(c);
  }
}
