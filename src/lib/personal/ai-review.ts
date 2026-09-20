// 個人モード専用: スクリーニング上位銘柄について、Gemini が最新ニュースをGoogle検索した上で
// 「数字だけでは見えないリスク」を含む総評を生成する。
//
// - Gemini API の無料枠で動く前提 (モデルは既定で gemini-3.8-flash、AI_REVIEW_MODEL で変更可)
// - 認証は GEMINI_API_KEY (.env.local)。Google AI Studio で発行する
// - ニュース検索は Gemini 内蔵の Google Search グラウンディングを使うため、追加のAPI契約は不要
// - 無料枠は 1分あたりのリクエスト数に上限があるため、銘柄ごとに間隔を空けて実行する

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { prisma } from "../db";
import { computeScreeningFromDb, computeScreeningForStock } from "../screening/engine";
import { DEFAULT_CRITERIA, type StockScreeningResult } from "../screening/types";

const MODEL = process.env.AI_REVIEW_MODEL || "gemini-3.8-flash";
const REVIEW_FRESH_HOURS = 24;
// 無料枠のRPM制限(概ね10/分)に収めるための銘柄間の待ち時間
const PAUSE_BETWEEN_STOCKS_MS = 7000;

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

export interface StoredReview {
  stockCode: string;
  stockName: string;
  generatedAt: string;
  model: string;
  rankAtTime: number | null;
  review: Review | null;
  rawText: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

export function isAiReviewConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

const SYSTEM_PROMPT = `あなたは日本株の配当投資に精通したアナリストです。
ユーザーは「10年以上減配なし・EPS成長・財務健全・配当利回り2〜7%」という機械的なスクリーニングで
上位に入った銘柄について、数字だけでは分からない実態とリスクを知りたがっています。

必ずGoogle検索を使って、その企業の直近3〜6ヶ月のニュース・決算・適時開示・業績修正・不祥事・
業界動向・株主還元方針の変更などを調べ、事実に基づいて評価してください。
検索は日本語で行い、企業名と証券コードの両方を使うと精度が上がります。

重視する視点:
- 増配が今後も続く根拠はあるか (利益成長・配当性向・キャッシュフロー・経営方針)
- 過去の増配実績が「たまたま」でないか (一時的な利益、資産売却、特別配当の可能性)
- 数字に表れない構造的リスク (主要顧客への依存、業界の縮小、規制、後継者問題、円安/円高の影響、
  原材料高、中国依存、大株主の動向、TOB/MBOの可能性、会計上の懸念)
- 直近で株価が急騰・急落していれば、その理由
- 最新決算の内容と会社予想の方向性

出力は必ず次のJSONのみを返してください。前後に説明文やコードブロック記号(\`\`\`)を付けないでください。
不明な項目は空配列または空文字にし、推測で埋めないでください。
{
  "headline": "1行の結論 (30字程度)",
  "summary": "総評。3〜6文。数字と事実に基づく",
  "strengths": ["強み・安心材料"],
  "hiddenRisks": [{"title": "リスクの見出し", "detail": "具体的な内容と根拠", "severity": "high|medium|low"}],
  "recentNews": [{"date": "YYYY-MM-DD", "title": "ニュースの要旨", "takeaway": "投資判断への含意", "url": "出典URL"}],
  "checkpoints": ["買う前にユーザー自身が確認すべきこと"],
  "stance": "候補として有力|条件付きで検討|様子見|見送り",
  "stanceReason": "そのスタンスの理由 (2〜3文)",
  "confidence": "high|medium|low",
  "sources": [{"title": "出典名", "url": "URL"}]
}

これは投資助言ではなく情報整理です。断定的な売買推奨は避け、判断材料を提示してください。`;

async function buildStockContext(code: string): Promise<{ text: string; screening: StockScreeningResult | null }> {
  const [stock, screening, prices] = await Promise.all([
    prisma.stock.findUnique({
      where: { code },
      include: {
        financials: { orderBy: { fiscalYear: "asc" } },
        dividends: { orderBy: { fiscalYear: "asc" } },
      },
    }),
    computeScreeningForStock(code, DEFAULT_CRITERIA),
    prisma.priceDaily.findMany({
      where: { stockCode: code },
      orderBy: { date: "desc" },
      take: 260,
      select: { date: true, close: true },
    }),
  ]);
  if (!stock) throw new Error(`銘柄 ${code} がデータベースにありません`);

  const closes = prices.map((p) => Number(p.close));
  const current = closes[0] ?? null;
  const high52 = closes.length ? Math.max(...closes) : null;
  const low52 = closes.length ? Math.min(...closes) : null;
  const ago = (n: number) => (closes.length > n ? closes[n] : null);
  const pct = (a: number | null, b: number | null) =>
    a !== null && b !== null && b !== 0 ? `${(((a - b) / b) * 100).toFixed(1)}%` : "-";

  const dividendLine = stock.dividends
    .map((d) => `${d.fiscalYear}:${Number(d.dividendPerShare)}${d.isSpecial ? "(特別)" : ""}`)
    .join(" ");
  const epsLine = stock.financials
    .filter((f) => f.eps !== null)
    .map((f) => `${f.fiscalYear}:${Number(f.eps)}`)
    .join(" ");
  const latestFin = stock.financials[stock.financials.length - 1];
  const b = screening?.breakdown;

  const text = [
    `【銘柄】${stock.name} (証券コード ${stock.code})`,
    `市場: ${stock.market ?? "-"} / 業種: ${stock.sector33 ?? "-"}`,
    ``,
    `【スクリーニング結果】`,
    `順位: ${screening?.rank ?? "圏外"} / 全条件クリア: ${screening?.passedAllRules ? "はい" : "いいえ"} / 総合スコア: ${screening?.compositeScore ?? "-"}`,
    `配当利回り: ${b?.dividendYield.value ?? "-"}%`,
    `減配なし年数: ${b?.dividendCutFree.years ?? "-"}年`,
    `財務健全性: ${b?.financialHealth.metric === "debtToEquity" ? `D/E比率 ${b.financialHealth.value}%` : `自己資本比率 ${b?.financialHealth.value ?? "-"}%`}`,
    `EPS成長性スコア: ${b?.epsTrend.score ?? "-"}点 (CAGR ${b?.epsTrend.cagrPercent ?? "-"}%, 下降年 ${b?.epsTrend.downYears ?? "-"}回)`,
    `直近3年の配当利回りレンジ内の位置: ${b?.yieldRange.percentileInRange ?? "-"}% (100に近いほど過去比で割安)`,
    `特別配当と判定した年: ${b?.specialDividendYears.join(", ") || "なし"}`,
    ``,
    `【株価】`,
    `現在値: ${current ?? "-"}円 / 52週高値: ${high52 ?? "-"} / 52週安値: ${low52 ?? "-"}`,
    `騰落率: 1ヶ月 ${pct(current, ago(21))} / 3ヶ月 ${pct(current, ago(63))} / 6ヶ月 ${pct(current, ago(126))} / 1年 ${pct(current, ago(250))}`,
    ``,
    `【1株配当の推移 (年度:円)】`,
    dividendLine || "データなし",
    ``,
    `【EPSの推移 (年度:円)】`,
    epsLine || "データなし",
    latestFin?.bps ? `BPS: ${Number(latestFin.bps)}円` : "",
    ``,
    `上記のデータを踏まえ、最新のニュースを検索して総評を作成してください。今日は ${new Date().toISOString().slice(0, 10)} です。`,
  ].join("\n");

  return { text, screening };
}

/** 応答テキストからJSONを取り出す。コードブロック記号や前後の文があっても最初の { から最後の } までを解釈する */
function extractJson(text: string): unknown | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function generateReviewForStock(code: string): Promise<StoredReview> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY が設定されていません");

  const ai = new GoogleGenAI({ apiKey });
  const { text: context, screening } = await buildStockContext(code);

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: context,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ googleSearch: {} }],
      temperature: 0.3,
    },
  });

  const candidate = response.candidates?.[0];
  const finishReason = candidate?.finishReason;
  if (finishReason && finishReason !== "STOP") {
    throw new Error(`生成が完了しませんでした (finishReason: ${finishReason})`);
  }

  const rawText = response.text ?? "";
  if (!rawText.trim()) throw new Error("モデルから空の応答が返りました");

  // グラウンディングで実際に参照したページ (モデルが出典を省略した場合の補完に使う)
  const groundedSources: { title: string; url: string }[] = [];
  for (const chunk of candidate?.groundingMetadata?.groundingChunks ?? []) {
    if (chunk.web?.uri) groundedSources.push({ title: chunk.web.title ?? chunk.web.uri, url: chunk.web.uri });
  }

  const parsed = ReviewSchema.safeParse(extractJson(rawText));
  let review: Review | null = null;
  if (parsed.success) {
    review = parsed.data;
    if (review.sources.length === 0) review.sources = groundedSources.slice(0, 10);
  }

  const data = {
    model: MODEL,
    rankAtTime: screening?.rank ?? null,
    content: JSON.stringify(review),
    rawText: review ? null : rawText,
    inputTokens: response.usageMetadata?.promptTokenCount ?? null,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
  };

  const saved = await prisma.aiReview.upsert({
    where: { stockCode: code },
    create: { stockCode: code, ...data },
    update: { generatedAt: new Date(), ...data },
    include: { stock: { select: { name: true } } },
  });

  return toStored(saved);
}

type AiReviewRow = {
  stockCode: string;
  generatedAt: Date;
  model: string;
  rankAtTime: number | null;
  content: string;
  rawText: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  stock: { name: string };
};

function toStored(row: AiReviewRow): StoredReview {
  const parsed = ReviewSchema.safeParse(JSON.parse(row.content || "null"));
  return {
    stockCode: row.stockCode,
    stockName: row.stock.name,
    generatedAt: row.generatedAt.toISOString(),
    model: row.model,
    rankAtTime: row.rankAtTime,
    review: parsed.success ? parsed.data : null,
    rawText: row.rawText,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
  };
}

export async function loadReviews(codes?: string[]): Promise<StoredReview[]> {
  const rows = await prisma.aiReview.findMany({
    where: codes ? { stockCode: { in: codes } } : undefined,
    include: { stock: { select: { name: true } } },
    orderBy: { generatedAt: "desc" },
  });
  return rows.map(toStored);
}

export async function topStockCodes(n: number): Promise<{ code: string; name: string; rank: number }[]> {
  const results = await computeScreeningFromDb(DEFAULT_CRITERIA);
  return results
    .filter((r) => r.rank !== null && r.rank <= n)
    .sort((a, b) => a.rank! - b.rank!)
    .map((r) => ({ code: r.code, name: r.name, rank: r.rank! }));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 上位N銘柄の総評をまとめて生成する。直近 REVIEW_FRESH_HOURS 以内に生成済みのものは force 指定がない限りスキップ。
 * 無料枠のレート制限に収めるため1件ずつ間隔を空けて実行する。
 */
export async function generateTopReviews(
  n = 10,
  force = false,
  onProgress?: (done: number, total: number, code: string, ok: boolean, message?: string) => void
): Promise<{ generated: string[]; skipped: string[]; failed: { code: string; error: string }[] }> {
  const top = await topStockCodes(n);
  const existing = await loadReviews(top.map((t) => t.code));
  const freshCutoff = Date.now() - REVIEW_FRESH_HOURS * 3600 * 1000;
  const fresh = new Set(
    existing.filter((r) => r.review && new Date(r.generatedAt).getTime() > freshCutoff).map((r) => r.stockCode)
  );

  const generated: string[] = [];
  const skipped: string[] = [];
  const failed: { code: string; error: string }[] = [];

  let done = 0;
  for (const t of top) {
    if (!force && fresh.has(t.code)) {
      skipped.push(t.code);
      done++;
      onProgress?.(done, top.length, t.code, true, "skip");
      continue;
    }
    if (generated.length + failed.length > 0) await sleep(PAUSE_BETWEEN_STOCKS_MS);
    try {
      await generateReviewForStock(t.code);
      generated.push(t.code);
      onProgress?.(done + 1, top.length, t.code, true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ code: t.code, error: message });
      onProgress?.(done + 1, top.length, t.code, false, message);
    }
    done++;
  }

  return { generated, skipped, failed };
}
