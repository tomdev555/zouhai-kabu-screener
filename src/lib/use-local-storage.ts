"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * ブラウザのlocalStorageに保存する状態。
 * 公開サイトはサーバーもDBも持たないため、ウォッチリストや保有銘柄は
 * 閲覧者それぞれのブラウザ内にだけ保存される(ログイン不要・他人には見えない)。
 *
 * localStorageは「Reactの外側にある状態」なので useSyncExternalStore で購読する。
 */

const listeners = new Set<() => void>();

function notifyAll() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // 別タブでの変更も反映する
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

// useSyncExternalStore は毎回同じ参照を返す必要があるため、生の文字列をキーにして解析結果をキャッシュする
const snapshotCache = new Map<string, { raw: string | null; parsed: unknown }>();

function readSnapshot<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return fallback; // プライベートモード等で読めない場合
  }

  const cached = snapshotCache.get(key);
  if (cached && cached.raw === raw) return cached.parsed as T;

  let parsed: unknown = fallback;
  if (raw !== null) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = fallback;
    }
  }
  snapshotCache.set(key, { raw, parsed });
  return parsed as T;
}

function subscribeNever(): () => void {
  return () => {};
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const value = useSyncExternalStore(
    subscribe,
    () => readSnapshot(key, initialValue),
    () => initialValue // サーバー描画・ハイドレーション時
  );

  // ハイドレーション完了後かどうか。読み込み前に「空です」と表示してしまうのを防ぐ
  const loaded = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = readSnapshot(key, initialValue);
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // 保存できない場合も画面上の操作は続行させる
      }
      notifyAll();
    },
    [key, initialValue]
  );

  return { value, setValue, loaded };
}
