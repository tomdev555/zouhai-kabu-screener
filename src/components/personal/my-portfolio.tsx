"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatYen } from "@/lib/utils";
import type { DividendView, PortfolioSummary, TradeView } from "@/lib/personal/positions";

interface StockOption {
  code: string;
  name: string;
}

export function MyPortfolio({
  portfolio,
  trades,
  dividends,
  stocks,
}: {
  portfolio: PortfolioSummary;
  trades: TradeView[];
  dividends: DividendView[];
  stocks: StockOption[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<"trade" | "dividend" | null>(null);
  const open = portfolio.positions.filter((p) => p.quantity > 0);
  const closed = portfolio.positions.filter((p) => p.quantity === 0);

  async function remove(kind: "trades" | "dividends", id: number, label: string) {
    if (!confirm(`${label} を削除しますか？`)) return;
    await fetch(`/api/my/${kind}/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="取得金額" value={formatYen(portfolio.totalCostBasis)} />
        <Stat label="評価金額" value={formatYen(portfolio.totalMarketValue)} />
        <Stat label="評価損益" value={signed(portfolio.totalUnrealizedPnl)} tone={portfolio.totalUnrealizedPnl} />
        <Stat label="実現損益" value={signed(portfolio.totalRealizedPnl)} tone={portfolio.totalRealizedPnl} />
        <Stat label="受取配当累計" value={formatYen(portfolio.totalDividend)} />
        <Stat label="トータルリターン" value={signed(portfolio.totalReturn)} tone={portfolio.totalReturn} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setForm(form === "trade" ? null : "trade")}>
          <Plus /> 取引を記録
        </Button>
        <Button size="sm" variant="outline" onClick={() => setForm(form === "dividend" ? null : "dividend")}>
          <Plus /> 配当を記録
        </Button>
      </div>

      {form === "trade" && <TradeForm stocks={stocks} onDone={() => { setForm(null); router.refresh(); }} />}
      {form === "dividend" && <DividendForm stocks={stocks} onDone={() => { setForm(null); router.refresh(); }} />}

      <Tabs defaultValue="positions">
        <TabsList>
          <TabsTrigger value="positions">保有ポジション ({open.length})</TabsTrigger>
          <TabsTrigger value="closed">決済済み ({closed.length})</TabsTrigger>
          <TabsTrigger value="trades">取引履歴 ({trades.length})</TabsTrigger>
          <TabsTrigger value="dividends">配当履歴 ({dividends.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="positions">
          <Panel>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>銘柄</TableHead>
                  <TableHead className="text-right">保有数</TableHead>
                  <TableHead className="text-right">平均取得単価</TableHead>
                  <TableHead className="text-right">現在値</TableHead>
                  <TableHead className="text-right">評価額</TableHead>
                  <TableHead className="text-right">評価損益</TableHead>
                  <TableHead className="text-right">受取配当</TableHead>
                  <TableHead className="text-right">トータル</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {open.map((p) => (
                  <TableRow key={p.stockCode}>
                    <TableCell>
                      <Link href={`/stocks/${p.stockCode}`} className="font-medium text-emerald-800 hover:underline dark:text-emerald-400">
                        {p.stockName}
                      </Link>
                      <div className="text-xs text-slate-400">{p.stockCode} ・ {p.sector ?? "-"}</div>
                    </TableCell>
                    <TableCell className="text-right">{p.quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatYen(p.averageCost)}</TableCell>
                    <TableCell className="text-right">{formatYen(p.currentPrice)}</TableCell>
                    <TableCell className="text-right">{formatYen(p.marketValue)}</TableCell>
                    <TableCell className={`text-right font-medium ${toneClass(p.unrealizedPnl)}`}>
                      {p.unrealizedPnl !== null ? signed(p.unrealizedPnl) : "-"}
                      {p.unrealizedPnlPct !== null && (
                        <div className="text-xs font-normal">{p.unrealizedPnlPct >= 0 ? "+" : ""}{p.unrealizedPnlPct}%</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatYen(p.dividendReceived)}</TableCell>
                    <TableCell className={`text-right font-medium ${toneClass(p.totalReturn)}`}>
                      {p.totalReturn !== null ? signed(p.totalReturn) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {open.length === 0 && <Empty cols={8} text="保有中のポジションはありません。「取引を記録」から買付を登録してください。" />}
              </TableBody>
            </Table>
          </Panel>
        </TabsContent>

        <TabsContent value="closed">
          <Panel>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>銘柄</TableHead>
                  <TableHead className="text-right">実現損益</TableHead>
                  <TableHead className="text-right">受取配当</TableHead>
                  <TableHead className="text-right">トータル</TableHead>
                  <TableHead className="text-right">取引回数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closed.map((p) => (
                  <TableRow key={p.stockCode}>
                    <TableCell>
                      <span className="font-medium">{p.stockName}</span>
                      <div className="text-xs text-slate-400">{p.stockCode}</div>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${toneClass(p.realizedPnl)}`}>{signed(p.realizedPnl)}</TableCell>
                    <TableCell className="text-right">{formatYen(p.dividendReceived)}</TableCell>
                    <TableCell className={`text-right font-medium ${toneClass(p.totalReturn)}`}>{signed(p.totalReturn ?? 0)}</TableCell>
                    <TableCell className="text-right">{p.tradeCount}</TableCell>
                  </TableRow>
                ))}
                {closed.length === 0 && <Empty cols={5} text="決済済みの銘柄はありません" />}
              </TableBody>
            </Table>
          </Panel>
        </TabsContent>

        <TabsContent value="trades">
          <Panel>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>約定日</TableHead>
                  <TableHead>銘柄</TableHead>
                  <TableHead>売買</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead className="text-right">単価</TableHead>
                  <TableHead className="text-right">手数料</TableHead>
                  <TableHead className="text-right">約定代金</TableHead>
                  <TableHead>口座</TableHead>
                  <TableHead>メモ</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.tradeDate}</TableCell>
                    <TableCell>
                      <span className="font-medium">{t.stockName}</span>
                      <div className="text-xs text-slate-400">{t.stockCode}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.side === "BUY" ? "danger" : "default"}>{t.side === "BUY" ? "買" : "売"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{t.quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatYen(t.price)}</TableCell>
                    <TableCell className="text-right">{formatYen(t.fee)}</TableCell>
                    <TableCell className="text-right">{formatYen(t.price * t.quantity)}</TableCell>
                    <TableCell className="text-slate-500">{t.accountName ?? "-"}</TableCell>
                    <TableCell className="text-slate-500 max-w-[200px] truncate">{t.note ?? ""}</TableCell>
                    <TableCell>
                      <DeleteButton onClick={() => remove("trades", t.id, `${t.tradeDate} ${t.stockName} ${t.side === "BUY" ? "買" : "売"} ${t.quantity}株`)} />
                    </TableCell>
                  </TableRow>
                ))}
                {trades.length === 0 && <Empty cols={10} text="取引がまだ記録されていません" />}
              </TableBody>
            </Table>
          </Panel>
        </TabsContent>

        <TabsContent value="dividends">
          <Panel>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>受取日</TableHead>
                  <TableHead>銘柄</TableHead>
                  <TableHead className="text-right">1株配当</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead className="text-right">受取額</TableHead>
                  <TableHead>メモ</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {dividends.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.paidDate}</TableCell>
                    <TableCell>
                      <span className="font-medium">{d.stockName}</span>
                      <div className="text-xs text-slate-400">{d.stockCode}</div>
                    </TableCell>
                    <TableCell className="text-right">{formatYen(d.amountPerShare)}</TableCell>
                    <TableCell className="text-right">{d.quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">{formatYen(d.totalAmount)}</TableCell>
                    <TableCell className="text-slate-500 max-w-[200px] truncate">{d.note ?? ""}</TableCell>
                    <TableCell>
                      <DeleteButton onClick={() => remove("dividends", d.id, `${d.paidDate} ${d.stockName} の配当`)} />
                    </TableCell>
                  </TableRow>
                ))}
                {dividends.length === 0 && <Empty cols={7} text="配当がまだ記録されていません" />}
              </TableBody>
            </Table>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TradeForm({ stocks, onDone }: { stocks: StockOption[]; onDone: () => void }) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [code, setCode] = useState("");
  const [tradeDate, setTradeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState("100");
  const [price, setPrice] = useState("");
  const [fee, setFee] = useState("0");
  const [accountName, setAccountName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const matched = stocks.find((s) => s.code === code.trim());

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/my/trades", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim(), side, tradeDate, quantity, price, fee, accountName, note }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "登録に失敗しました");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登録に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>取引を記録</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Button size="sm" variant={side === "BUY" ? "destructive" : "outline"} onClick={() => setSide("BUY")}>買い</Button>
          <Button size="sm" variant={side === "SELL" ? "default" : "outline"} onClick={() => setSide("SELL")}>売り</Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="銘柄コード">
            <Input list="my-stock-codes" value={code} onChange={(e) => setCode(e.target.value)} placeholder="例: 7937" />
            <datalist id="my-stock-codes">
              {stocks.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </datalist>
            {matched && <div className="text-xs text-emerald-700 dark:text-emerald-400">{matched.name}</div>}
          </Field>
          <Field label="約定日"><Input type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} /></Field>
          <Field label="数量"><Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
          <Field label="約定単価"><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
          <Field label="手数料"><Input type="number" value={fee} onChange={(e) => setFee(e.target.value)} /></Field>
          <Field label="口座 (任意)"><Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="例: SBI NISA" /></Field>
          <Field label="メモ (任意)" className="sm:col-span-2"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={busy || !code || !price || !quantity}>{busy ? "登録中..." : "登録する"}</Button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function DividendForm({ stocks, onDone }: { stocks: StockOption[]; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState("100");
  const [amountPerShare, setAmountPerShare] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const matched = stocks.find((s) => s.code === code.trim());

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/my/dividends", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim(), paidDate, quantity, amountPerShare, totalAmount, note }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "登録に失敗しました");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登録に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>配当を記録</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="銘柄コード">
            <Input list="my-stock-codes-div" value={code} onChange={(e) => setCode(e.target.value)} placeholder="例: 7937" />
            <datalist id="my-stock-codes-div">
              {stocks.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </datalist>
            {matched && <div className="text-xs text-emerald-700 dark:text-emerald-400">{matched.name}</div>}
          </Field>
          <Field label="受取日"><Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} /></Field>
          <Field label="数量"><Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
          <Field label="1株配当 (任意)"><Input type="number" value={amountPerShare} onChange={(e) => setAmountPerShare(e.target.value)} /></Field>
          <Field label="受取額 (税引後)"><Input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} /></Field>
          <Field label="メモ (任意)" className="sm:col-span-3"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={busy || !code || !totalAmount || !quantity}>{busy ? "登録中..." : "登録する"}</Button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <Card>
      <CardHeader><CardTitle>{label}</CardTitle></CardHeader>
      <CardContent className={`text-lg font-semibold ${tone !== undefined ? toneClass(tone) : ""}`}>{value}</CardContent>
    </Card>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">{children}</div>;
}

function Empty({ cols, text }: { cols: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-8 text-center text-slate-400">{text}</TableCell>
    </TableRow>
  );
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-slate-400 hover:text-red-600" aria-label="削除">
      <Trash2 className="size-4" />
    </button>
  );
}

function signed(n: number): string {
  return `${n >= 0 ? "+" : ""}${formatYen(n)}`;
}

function toneClass(n: number | null): string {
  if (n === null) return "";
  return n >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600";
}
