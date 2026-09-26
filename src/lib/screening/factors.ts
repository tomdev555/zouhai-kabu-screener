// スコアの構成要素(評価軸)を1か所にまとめる。
// - 総合スコアの重み付け (engine/rules から使う)
// - 一覧で「悪い数値」にポップアップで出す理由
// - 閲覧者が自分で優先順位を付けて並び替えるときの候補
// どれも同じ定義を使うので、評価軸を足すときはここだけ直せばよい。

import type { RuleBreakdown, ScreeningCriteria } from "./types";

export type FactorKey =
  | "dividendCutFree"
  | "epsTrend"
  | "earningsMomentum"
  | "dividendYield"
  | "financialHealth"
  | "valuation"
  | "cash"
  | "yieldRange";

export interface FactorDef {
  key: FactorKey;
  label: string;
  /** 総合スコアでの既定の重み (合計1.0) */
  defaultWeight: number;
  /** 0-100に正規化したスコア */
  score: (b: RuleBreakdown) => number;
  /**
   * 数値が悪いときの理由。問題なければ null。
   * 「条件クリア」でも弱いところは拾いたいので、足切りに引っかかっていなくても返すことがある。
   */
  concern: (b: RuleBreakdown, c: ScreeningCriteria) => string | null;
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 財務健全性を0-100に正規化する (自己資本比率は高いほど、D/E比率は低いほど高得点) */
export function financialHealthScore(health: RuleBreakdown["financialHealth"]): number {
  if (health.value === null) return 0;
  if (health.metric === "equityRatio") return clamp((health.value / 60) * 100);
  return clamp(100 - (health.value / 200) * 100);
}

export const FACTORS: FactorDef[] = [
  {
    key: "dividendCutFree",
    label: "減配なし年数",
    defaultWeight: 0.2,
    score: (b) => clamp((b.dividendCutFree.years / 15) * 100),
    concern: (b, c) => {
      if (b.dividendCutFree.years < c.minDividendCutFreeYears) {
        return `減配なしが${b.dividendCutFree.years}年で、基準の${c.minDividendCutFreeYears}年に届いていません。増配を続ける姿勢がまだ確認しきれない水準です。`;
      }
      if (b.dividendCutFree.years < 15) {
        return `減配なし${b.dividendCutFree.years}年。基準は満たしていますが、15年で満点のため配点上はやや物足りません。`;
      }
      return null;
    },
  },
  {
    key: "epsTrend",
    label: "EPS成長性",
    defaultWeight: 0.15,
    score: (b) => b.epsTrend.score,
    concern: (b, c) => {
      const detail = `CAGR ${b.epsTrend.cagrPercent ?? "-"}%・下降年${b.epsTrend.downYears}回`;
      if (!b.epsTrend.pass) {
        return `EPS成長性が${b.epsTrend.score.toFixed(0)}点で、基準の${c.minEpsTrendScore}点に届いていません (${detail})。1株あたり利益が伸び悩んでいます。`;
      }
      if (b.epsTrend.score < 70) {
        return `EPS成長性は${b.epsTrend.score.toFixed(0)}点 (${detail})。基準は満たすものの、伸びは力強くありません。`;
      }
      return null;
    },
  },
  {
    key: "earningsMomentum",
    label: "増収増益",
    defaultWeight: 0.15,
    score: (b) => b.earningsMomentum.score,
    concern: (b) => {
      const m = b.earningsMomentum;
      const parts: string[] = [];
      if (m.negatives.length > 0) parts.push(m.negatives.join(" / "));
      if (m.annualDataIssue) parts.push(m.annualDataIssue);
      if (parts.length === 0) return null;
      if (m.hasSevereAnnualDrop) parts.push("通期の減益幅が大きく、増配の原資が細るおそれがあります。");
      return parts.join("。");
    },
  },
  {
    key: "dividendYield",
    label: "配当利回り",
    defaultWeight: 0.15,
    score: (b) => b.dividendYield.score,
    concern: (b, c) => {
      const v = b.dividendYield.value;
      if (v === null) return "配当利回りを算出できませんでした (配当データまたは株価が取れていません)。";
      if (v > c.maxDividendYield) {
        return `配当利回り${v}%は合格帯(${c.minDividendYield}〜${c.maxDividendYield}%)の上限を超えています。高すぎる利回りは減配の前触れであることが多いため注意が必要です。`;
      }
      if (v < c.minDividendYield) {
        return `配当利回り${v}%は合格帯(${c.minDividendYield}〜${c.maxDividendYield}%)の下限を下回ります。株価が買われすぎで、投資額の回収に時間がかかります。`;
      }
      const gap = round1(Math.abs(v - c.targetDividendYield));
      if (gap > 1) {
        return `配当利回り${v}%は理想の${c.targetDividendYield}%から${gap}ポイント離れています (${v > c.targetDividendYield ? "高め" : "低め"})。合格帯には入っています。`;
      }
      return null;
    },
  },
  {
    key: "financialHealth",
    label: "財務健全性",
    defaultWeight: 0.12,
    score: (b) => financialHealthScore(b.financialHealth),
    concern: (b, c) => {
      const h = b.financialHealth;
      if (h.value === null) return "自己資本比率もD/E比率も取得できず、借金の重さを判定できていません。";
      if (!h.pass) {
        return h.metric === "equityRatio"
          ? `自己資本比率${h.value}%が基準の${c.minEquityRatio}%を下回ります。`
          : `D/E比率${h.value}%が基準の${c.maxDebtToEquity}%を超えています。有利子負債が自己資本に対して重い状態です。`;
      }
      if (financialHealthScore(h) < 50) {
        return h.metric === "equityRatio"
          ? `自己資本比率${h.value}%。基準は満たしますが厚いとは言えません。`
          : `D/E比率${h.value}%。基準は満たしますが、無借金の会社と比べると負債は多めです。`;
      }
      return null;
    },
  },
  {
    key: "valuation",
    label: "PER",
    defaultWeight: 0.1,
    score: (b) => b.valuation.score,
    concern: (b, c) => {
      const per = b.valuation.per;
      if (per === null) return `PERを算出できません (赤字、またはEPSが取れていません)。割安・割高の判断ができない状態です。`;
      if (per > c.basePer) {
        return `PER${per}倍は基準の${c.basePer}倍より割高です。利益に対して株価が高く、値下がり余地があります。`;
      }
      return null;
    },
  },
  {
    key: "cash",
    label: "現金確保",
    defaultWeight: 0.08,
    score: (b) => b.cash.score,
    concern: (b, c) => {
      const r = b.cash.cashToMarketCap;
      if (r === null) return "現預金または時価総額が取得できず、手元資金の厚さを判定できていません。";
      if (r < c.cashRatioFullScore / 2) {
        return `現預金は時価総額の${r}%。${c.cashRatioFullScore}%で満点とする基準からすると手元資金は薄めで、業績が崩れたときの配当維持の余力は小さくなります。`;
      }
      return null;
    },
  },
  {
    key: "yieldRange",
    label: "利回りの割安度",
    defaultWeight: 0.05,
    score: (b) => b.yieldRange.percentileInRange ?? 50,
    concern: (b) => {
      const p = b.yieldRange.percentileInRange;
      if (p === null) return null;
      if (p < 30) {
        return `直近3年の自社の利回りレンジの中で下から${p}%の位置です。過去と比べて利回りが低く、株価は高値圏にあります。`;
      }
      return null;
    },
  },
];

export const FACTOR_BY_KEY: Record<FactorKey, FactorDef> = Object.fromEntries(
  FACTORS.map((f) => [f.key, f])
) as Record<FactorKey, FactorDef>;

/** 重み付けの合計でスコアを出す。重みは合計で割って正規化するため、相対的な大小だけ合っていればよい */
export function weightedScore(b: RuleBreakdown, weights: Partial<Record<FactorKey, number>>): number {
  let total = 0;
  let sum = 0;
  for (const f of FACTORS) {
    const w = weights[f.key] ?? 0;
    if (w <= 0) continue;
    total += w;
    sum += f.score(b) * w;
  }
  if (total === 0) return 0;
  return Math.round((sum / total) * 100) / 100;
}

/** 既定の重みでの総合スコア */
export function defaultCompositeScore(b: RuleBreakdown): number {
  return weightedScore(
    b,
    Object.fromEntries(FACTORS.map((f) => [f.key, f.defaultWeight])) as Record<FactorKey, number>
  );
}

export interface Concern {
  key: FactorKey;
  label: string;
  reason: string;
  /** その項目で足切りに引っかかっているか (条件クリアの銘柄でも弱点として拾うため区別する) */
  blocking: boolean;
}

/** 「条件クリア」でも拾いたい弱点を、重みの大きい順に返す */
export function collectConcerns(b: RuleBreakdown, c: ScreeningCriteria): Concern[] {
  const blockingByKey: Partial<Record<FactorKey, boolean>> = {
    dividendCutFree: !b.dividendCutFree.pass,
    epsTrend: !b.epsTrend.pass,
    earningsMomentum: !b.earningsMomentum.pass,
    dividendYield: !b.dividendYield.pass,
    financialHealth: !b.financialHealth.pass,
  };

  return FACTORS.flatMap((f) => {
    const reason = f.concern(b, c);
    if (!reason) return [];
    return [{ key: f.key, label: f.label, reason, blocking: blockingByKey[f.key] ?? false }];
  }).sort((a, b2) => {
    if (a.blocking !== b2.blocking) return a.blocking ? -1 : 1;
    return FACTOR_BY_KEY[b2.key].defaultWeight - FACTOR_BY_KEY[a.key].defaultWeight;
  });
}
