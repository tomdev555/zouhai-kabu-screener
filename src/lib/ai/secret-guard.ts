// 公開用JSONにAPIキー等が混入していないかを検査する。publish-ai.ts から使う。

import { promises as fs } from "fs";
import path from "path";

/** .env.local / .env に書かれている値のうち、キーらしきもの (十分に長い英数字) を集める */
export async function loadSecretValues(cwd = process.cwd()): Promise<string[]> {
  const secrets: string[] = [];
  for (const file of [".env.local", ".env"]) {
    try {
      const text = await fs.readFile(path.join(cwd, file), "utf-8");
      for (const line of text.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]+)"?\s*$/);
        if (!m) continue;
        const value = m[2].trim();
        if (value.length >= 16 && /[A-Za-z0-9]/.test(value) && !value.startsWith("file:")) secrets.push(value);
      }
    } catch {
      // ファイルが無ければ何もしない
    }
  }
  return secrets;
}

const KEY_PATTERNS = [
  /AIza[0-9A-Za-z_-]{30,}/, // Google API key
  /AQ\.[0-9A-Za-z_-]{30,}/, // Google AI Studio の新形式
  /sk-[0-9A-Za-z_-]{20,}/, // OpenAI / Anthropic 等
  /ghp_[0-9A-Za-z]{30,}/, // GitHub PAT
];

/** 書き出し内容に秘密情報が混入していないか検査する。見つかったら例外 */
export function assertNoSecrets(json: string, secrets: string[]): void {
  for (const s of secrets) {
    if (json.includes(s)) throw new Error("書き出し内容に .env のキー値が含まれています。中断しました");
  }
  for (const p of KEY_PATTERNS) {
    if (p.test(json)) throw new Error(`書き出し内容にAPIキーらしき文字列 (${p}) が含まれています。中断しました`);
  }
}
