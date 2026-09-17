"use client";

import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocalStorage } from "@/lib/use-local-storage";
import { WATCHLIST_KEY } from "@/lib/storage-keys";

export function WatchButton({ code }: { code: string }) {
  const { value: codes, setValue: setCodes, loaded } = useLocalStorage<string[]>(WATCHLIST_KEY, []);
  const watched = codes.includes(code);

  function toggle() {
    setCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  return (
    <Button variant={watched ? "default" : "outline"} size="sm" onClick={toggle} disabled={!loaded}>
      <Star className={watched ? "fill-white" : ""} />
      {watched ? "ウォッチ中" : "ウォッチリストに追加"}
    </Button>
  );
}
