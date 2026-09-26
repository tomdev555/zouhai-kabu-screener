// Googleニュースの検索RSS (キー不要・無料) から、銘柄に関する直近のニュース見出しを集める。
// Gemini無料枠ではGoogle検索グラウンディングが使えないため、ニュースはこちらで集めてプロンプトに渡す。

import { XMLParser } from "fast-xml-parser";

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string; // YYYY-MM-DD
  snippet: string;
}

const RSS_BASE = "https://news.google.com/rss/search";
const USER_AGENT = "Mozilla/5.0 (compatible; zouhai-kabu-screener/1.0)";

interface RssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  source?: string | { "#text"?: string };
}

async function fetchFeed(query: string, days: number): Promise<NewsItem[]> {
  const url = new URL(RSS_BASE);
  url.searchParams.set("q", `${query} when:${days}d`);
  url.searchParams.set("hl", "ja");
  url.searchParams.set("gl", "JP");
  url.searchParams.set("ceid", "JP:ja");

  const res = await fetch(url.toString(), { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];

  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml) as { rss?: { channel?: { item?: RssItem | RssItem[] } } };
  const raw = parsed.rss?.channel?.item;
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];

  return items
    .map((it) => {
      const source = typeof it.source === "string" ? it.source : it.source?.["#text"] ?? "";
      const published = it.pubDate ? new Date(it.pubDate) : null;
      return {
        title: stripSource(String(it.title ?? ""), source),
        url: String(it.link ?? ""),
        source,
        publishedAt: published && !Number.isNaN(published.getTime()) ? published.toISOString().slice(0, 10) : "",
        snippet: stripHtml(String(it.description ?? "")),
      };
    })
    .filter((n) => n.title && n.url);
}

/** Googleニュースのタイトル末尾に付く " - 媒体名" を除去する */
function stripSource(title: string, source: string): string {
  if (source && title.endsWith(` - ${source}`)) return title.slice(0, -(source.length + 3));
  return title;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 銘柄名・証券コードで複数の検索を行い、重複を除いて新しい順に返す。
 * 会社名だけだと同名の一般語に引っ張られることがあるため、「決算」「株」などを組み合わせる。
 */
export async function fetchStockNews(
  name: string,
  code: string,
  days = 180,
  limit = 20,
  /** 減収・減益のときに、その原因を報じた記事や会社の開示を追加で探す */
  investigateEarningsDrop = false
): Promise<NewsItem[]> {
  const cleanName = name.replace(/\s+/g, "").replace(/ホールディングス$/, "");
  const queries = [`"${cleanName}" ${code}`, `${cleanName} 決算 OR 配当 OR 業績`, `${cleanName} 株価`];
  if (investigateEarningsDrop) {
    // 「決算短信がマイナスなら原因を追究する」ための検索。会社が出した説明を拾いにいく
    queries.push(`${cleanName} 減益 OR 減収 OR 下方修正 OR 業績予想の修正`);
    queries.push(`${cleanName} 決算説明 OR 要因 OR 特別損失`);
  }

  const results = await Promise.all(queries.map((q) => fetchFeed(q, days).catch(() => [] as NewsItem[])));

  const seen = new Set<string>();
  const merged: NewsItem[] = [];
  for (const item of results.flat()) {
    const key = item.title.replace(/\s+/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, limit);
}
