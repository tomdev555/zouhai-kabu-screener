// AI総評・会社概要のデータ形。生成側(個人モード)と表示側(公開サイト)の両方で使う。
// このファイルは zod だけに依存し、Gemini SDK や DB には触れない (公開バンドルに含まれるため)。

import { z } from "zod";

export const ReviewSchema = z.object({
  headline: z.string().describe("1行の結論"),
  summary: z.string().describe("総評 (3〜6文)"),
  strengths: z.array(z.string()).describe("強み・安心材料"),
  hiddenRisks: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        severity: z.enum(["high", "medium", "low"]),
      })
    )
    .describe("スクリーニングの数字だけでは見えないリスク"),
  recentNews: z
    .array(
      z.object({
        date: z.string().describe("YYYY-MM-DD または YYYY-MM。不明なら空文字"),
        title: z.string(),
        takeaway: z.string().describe("投資判断への含意"),
        url: z.string().optional(),
      })
    )
    .describe("直近のニュース・開示"),
  checkpoints: z.array(z.string()).describe("買う前に自分で確認すべきこと"),
  stance: z.enum(["候補として有力", "条件付きで検討", "様子見", "見送り"]),
  stanceReason: z.string(),
  confidence: z.enum(["high", "medium", "low"]).describe("情報の十分さに基づく自信度"),
  sources: z.array(z.object({ title: z.string(), url: z.string() })),
});

export type Review = z.infer<typeof ReviewSchema>;

export const ProfileSchema = z.object({
  tokushoku: z.string().describe("四季報の【特色】欄のような60〜90字の要約"),
  business: z.string().describe("事業内容。何を誰に売っているか、3〜5文"),
  segments: z
    .array(z.object({ name: z.string(), note: z.string() }))
    .describe("主な事業セグメント・製品と一言説明"),
  history: z.string().describe("沿革・成り立ち。創業、主な転機、2〜4文"),
  strengths: z.array(z.string()).describe("競争優位・強み"),
  customersMarkets: z.string().describe("主な顧客層・市場・地域"),
  performanceTrend: z.string().describe("業績の傾向。渡された数値に基づく2〜3文"),
  shareholderReturn: z.string().describe("配当・株主還元の方針や実績"),
  watchPoints: z.array(z.string()).describe("投資家として押さえておくべき注目点"),
  basics: z.object({
    headquarters: z.string(),
    employees: z.string(),
    industry: z.string(),
    marketCap: z.string(),
    website: z.string(),
    officers: z.array(z.string()).describe("役職と氏名。日本語表記が分かる場合は日本語で"),
  }),
  uncertainties: z.array(z.string()).describe("元データが不足していて確信が持てない項目"),
});

export type CompanyProfileContent = z.infer<typeof ProfileSchema>;

/** 表示用の総評 (DB由来でも公開JSON由来でも同じ形) */
export interface ReviewRecord {
  stockCode: string;
  stockName: string;
  generatedAt: string;
  model: string;
  review: Review;
}

/** 表示用の会社概要 */
export interface ProfileRecord {
  stockCode: string;
  stockName: string;
  generatedAt: string;
  model: string;
  profile: CompanyProfileContent;
}
