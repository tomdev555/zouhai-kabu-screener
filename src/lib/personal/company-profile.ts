// 個人モード専用: 四季報風の会社概要を Gemini で生成する。
// 元データは Yahoo Finance の企業プロフィール (業種・従業員数・本社・役員・英文の事業概要) と
// 当アプリの財務データ。会社四季報そのものは使っていない (有料・著作物のため)。

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { prisma } from "../db";
import { fetchCompanyProfile, type YahooCompanyProfile } from "../data-sources/yahoo-finance";

const MODEL_CANDIDATES = process.env.AI_REVIEW_MODEL
  ? [process.env.AI_REVIEW_MODEL]
  : ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.5-flash-lite"];

// 会社概要は頻繁に変わらないため、この期間内なら再生成しない
export const PROFILE_FRESH_DAYS = 30;

export { ProfileSchema, type CompanyProfileContent } from "../ai/schemas";
import { ProfileSchema, type CompanyProfileContent } from "../ai/schemas";

export interface StoredProfile {
  stockCode: string;
  stockName: string;
  generatedAt: string;
  model: string;
  profile: CompanyProfileContent | null;
}

const SYSTEM_PROMPT = `あなたは日本株の企業分析に精通したアナリストです。
渡された企業データをもとに、会社四季報の紹介欄のような、簡潔で情報密度の高い日本語の会社概要を作成してください。

ルール:
- 事実に基づき、渡されたデータとあなたの一般的な企業知識の範囲で書く。数値を捏造しない
- 英文の事業概要は自然な日本語に訳して要約する。製品名・薬品名などは一般的な日本語表記があればそれを使う
- 役員名はローマ字で渡されるので、一般に知られている日本語表記に直せる場合は直す。不明なら元の表記のまま
- 確信が持てない項目は uncertainties に列挙し、本文では断定を避ける
- 投資助言はしない。事実の整理に徹する
- 【特色】は四季報の文体 (体言止め・簡潔) に倣う。例: 「橋梁など既存インフラの補修・補強に特化。無借金経営で17期連続増配」`;

function yen(n: number | null): string {
  if (n === null) return "不明";
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}兆円`;
  if (n >= 1e8) return `${Math.round(n / 1e8).toLocaleString()}億円`;
  return `${Math.round(n / 1e4).toLocaleString()}万円`;
}

async function buildContext(code: string): Promise<{ text: string; source: YahooCompanyProfile | null; name: string }> {
  const stock = await prisma.stock.findUnique({
    where: { code },
    include: {
      financials: { orderBy: { fiscalYear: "asc" } },
      dividends: { orderBy: { fiscalYear: "asc" } },
    },
  });
  if (!stock) throw new Error(`銘柄 ${code} がデータベースにありません`);

  const source = await fetchCompanyProfile(code).catch(() => null);

  const dividendLine = stock.dividends.map((d) => `${d.fiscalYear}:${Number(d.dividendPerShare)}`).join(" ");
  const epsLine = stock.financials
    .filter((f) => f.eps !== null)
    .map((f) => `${f.fiscalYear}:${Number(f.eps)}`)
    .join(" ");

  const text = [
    `【銘柄】${stock.name} (証券コード ${stock.code})`,
    `市場: ${stock.market ?? "-"} / 東証33業種: ${stock.sector33 ?? "-"}`,
    `現在値: ${stock.currentPrice ? Number(stock.currentPrice) : "-"}円`,
    ``,
    `【Yahoo Finance 企業プロフィール】`,
    `業種(英): ${source?.industry ?? "-"} / セクター(英): ${source?.sector ?? "-"}`,
    `従業員数: ${source?.employees ?? "不明"}`,
    `本社: ${source?.address ?? "不明"}`,
    `ウェブサイト: ${source?.website ?? "不明"}`,
    `時価総額: ${yen(source?.marketCap ?? null)} / PER: ${source?.trailingPE?.toFixed(1) ?? "-"} / PBR: ${source?.priceToBook?.toFixed(2) ?? "-"}`,
    `役員: ${source?.officers.map((o) => `${o.name} (${o.title})`).join("; ") || "不明"}`,
    `事業概要(英文): ${source?.businessSummary ?? "なし"}`,
    ``,
    `【1株配当の推移 (年度:円)】`,
    dividendLine || "データなし",
    `【EPSの推移 (年度:円)】`,
    epsLine || "データなし",
    ``,
    `上記をもとに会社概要を作成してください。今日は ${new Date().toISOString().slice(0, 10)} です。`,
  ].join("\n");

  return { text, source, name: stock.name };
}

function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /"code":(429|503)|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded/i.test(msg);
}

export async function generateCompanyProfile(code: string): Promise<StoredProfile> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY が設定されていません");

  const ai = new GoogleGenAI({ apiKey });
  const { text, source, name } = await buildContext(code);
  const responseJsonSchema = z.toJSONSchema(ProfileSchema);

  let raw = "";
  let usedModel = MODEL_CANDIDATES[0];
  let lastError: unknown = null;
  for (const model of MODEL_CANDIDATES) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: text,
        config: { systemInstruction: SYSTEM_PROMPT, responseMimeType: "application/json", responseJsonSchema, temperature: 0.2 },
      });
      const finish = res.candidates?.[0]?.finishReason;
      if (finish && finish !== "STOP") throw new Error(`生成が完了しませんでした (finishReason: ${finish})`);
      raw = res.text ?? "";
      usedModel = model;
      break;
    } catch (err) {
      lastError = err;
      if (!isRetryable(err)) throw err;
    }
  }
  if (!raw) {
    throw new Error(`無料枠で利用できるモデルがありません: ${lastError instanceof Error ? lastError.message.slice(0, 200) : lastError}`);
  }

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const parsed = ProfileSchema.safeParse(start >= 0 ? JSON.parse(raw.slice(start, end + 1)) : null);
  if (!parsed.success) throw new Error("会社概要の応答を解釈できませんでした");

  const data = {
    model: usedModel,
    content: JSON.stringify(parsed.data),
    sourceJson: source ? JSON.stringify(source) : null,
  };
  const saved = await prisma.companyProfile.upsert({
    where: { stockCode: code },
    create: { stockCode: code, ...data },
    update: { generatedAt: new Date(), ...data },
  });

  return {
    stockCode: code,
    stockName: name,
    generatedAt: saved.generatedAt.toISOString(),
    model: saved.model,
    profile: parsed.data,
  };
}

export async function loadCompanyProfile(code: string): Promise<StoredProfile | null> {
  const row = await prisma.companyProfile.findUnique({
    where: { stockCode: code },
    include: { stock: { select: { name: true } } },
  });
  if (!row) return null;
  const parsed = ProfileSchema.safeParse(JSON.parse(row.content));
  return {
    stockCode: row.stockCode,
    stockName: row.stock.name,
    generatedAt: row.generatedAt.toISOString(),
    model: row.model,
    profile: parsed.success ? parsed.data : null,
  };
}

export function isProfileFresh(p: StoredProfile | null): boolean {
  if (!p?.profile) return false;
  return Date.now() - new Date(p.generatedAt).getTime() < PROFILE_FRESH_DAYS * 24 * 3600 * 1000;
}
