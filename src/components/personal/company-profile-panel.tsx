"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompanyProfileCard } from "@/components/ai/company-profile-card";
import type { StoredProfile } from "@/lib/personal/company-profile";

/** 個人モードの会社概要パネル。表示は共通の CompanyProfileCard に任せ、生成・再生成ボタンを付ける。 */
export function CompanyProfilePanel({ code, profile, configured }: { code: string; profile: StoredProfile | null; configured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/my/profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "生成に失敗しました");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  const emptyText = !configured
    ? ".env.local に GEMINI_API_KEY を設定すると生成できます。"
    : busy
      ? "生成中… 10〜30秒ほどかかります。"
      : error ?? "まだ生成されていません。「生成」を押すと会社概要を作成します。";

  return (
    <CompanyProfileCard
      profile={profile?.profile ?? null}
      generatedAt={profile?.generatedAt}
      model={profile?.model}
      emptyText={emptyText}
      action={
        configured ? (
          <Button size="sm" variant="outline" onClick={generate} disabled={busy}>
            <RefreshCw className={busy ? "animate-spin" : ""} />
            {profile?.profile ? "再生成" : "生成"}
          </Button>
        ) : undefined
      }
    />
  );
}
