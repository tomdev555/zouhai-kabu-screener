import { NextRequest, NextResponse } from "next/server";
import { generateCompanyProfile } from "@/lib/personal/company-profile";
import { isAiReviewConfigured } from "@/lib/personal/ai-review";

/** body: { code: "7937" } … 会社概要を生成 (常に再生成) */
export async function POST(req: NextRequest) {
  if (!isAiReviewConfigured()) {
    return NextResponse.json(
      { error: ".env.local に GEMINI_API_KEY を設定してサーバーを再起動してください" },
      { status: 400 }
    );
  }
  const body = await req.json().catch(() => ({}));
  if (!body.code) return NextResponse.json({ error: "code は必須です" }, { status: 400 });

  try {
    const profile = await generateCompanyProfile(String(body.code));
    return NextResponse.json(profile);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
