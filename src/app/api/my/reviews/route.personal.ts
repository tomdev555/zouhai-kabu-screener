import { NextRequest, NextResponse } from "next/server";
import {
  generateReviewForStock,
  generateTopReviews,
  isAiReviewConfigured,
  loadReviews,
} from "@/lib/personal/ai-review";

export async function GET() {
  return NextResponse.json({ configured: isAiReviewConfigured(), reviews: await loadReviews() });
}

/**
 * body: { code: "7937" }           … 1銘柄だけ生成 (常に再生成)
 *       { top: 10, force: false }  … 上位N銘柄をまとめて生成 (24時間以内のものはスキップ)
 */
export async function POST(req: NextRequest) {
  if (!isAiReviewConfigured()) {
    return NextResponse.json(
      { error: ".env.local に GEMINI_API_KEY を設定してサーバーを再起動してください" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));

  try {
    if (body.code) {
      const review = await generateReviewForStock(String(body.code));
      return NextResponse.json({ generated: [review.stockCode], skipped: [], failed: [] });
    }
    const result = await generateTopReviews(Number(body.top ?? 10), Boolean(body.force));
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
