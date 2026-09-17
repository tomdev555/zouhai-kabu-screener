"use client";

import { Fragment, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatYen } from "@/lib/utils";
import { useLocalStorage } from "@/lib/use-local-storage";
import { HOLDINGS_KEY } from "@/lib/storage-keys";

export interface StoredHolding {
  id: string;
  code: string;
  accountName: string;
  buyDate: string;
  quantity: number;
  buyPrice: number;
  note: string;
  dividends: { id: string; paidDate: string; amountPerShare: number; totalAmount: number }[];
}

interface StockOption {
  code: string;
  name: string;
  currentPrice: number | null;
}

export function PortfolioClient({ stocks }: { stocks: StockOption[] }) {
  const { value: holdings, setValue: setHoldings, loaded } = useLocalStorage<StoredHolding[]>(HOLDINGS_KEY, []);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const priceByCode = new Map(stocks.map((s) => [s.code, s.currentPrice]));
  const nameByCode = new Map(stocks.map((s) => [s.code, s.name]));

  const views = holdings.map((h) => {
    const currentPrice = priceByCode.get(h.code) ?? null;
    const costBasis = h.buyPrice * h.quantity;
    const marketValue = currentPrice !== null ? currentPrice * h.quantity : null;
    return {
      ...h,
      name: nameByCode.get(h.code) ?? h.code,
      currentPrice,
      costBasis,
      marketValue,
      unrealizedPnl: marketValue !== null ? marketValue - costBasis : null,
      dividendIncome: h.dividends.reduce((s, d) => s + d.totalAmount, 0),
    };
  });

  const totalCost = views.reduce((s, v) => s + v.costBasis, 0);
  const totalValue = views.reduce((s, v) => s + (v.marketValue ?? 0), 0);
  const totalDividend = views.reduce((s, v) => s + v.dividendIncome, 0);
  const totalPnl = totalValue - totalCost;

  if (!loaded) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="取得金額合計" value={formatYen(totalCost)} />
        <SummaryCard label="評価金額合計" value={formatYen(totalValue)} />
        <SummaryCard
          label="評価損益"
          value={`${totalPnl >= 0 ? "+" : ""}${formatYen(totalPnl)}`}
          className={totalPnl >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600"}
        />
        <SummaryCard label="受取配当累計" value={formatYen(totalDividend)} />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-medium">保有銘柄一覧</h2>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus /> 保有銘柄を追加
        </Button>
      </div>

      {showForm && (
        <AddHoldingForm
          stocks={stocks}
          onAdd={(holding) => {
            setHoldings((prev) => [holding, ...prev]);
            setShowForm(false);
          }}
        />
      )}

      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>銘柄</TableHead>
              <TableHead>口座</TableHead>
              <TableHead className="text-right">数量</TableHead>
              <TableHead className="text-right">取得単価</TableHead>
              <TableHead className="text-right">現在値</TableHead>
              <TableHead className="text-right">評価損益</TableHead>
              <TableHead className="text-right">受取配当</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {views.map((h) => (
              <Fragment key={h.id}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => setExpanded(expanded === h.id ? null : h.id)}
                >
                  <TableCell>
                    <div className="font-medium">{h.name}</div>
                    <div className="text-xs text-slate-400">
                      {h.code} ・ 購入日 {h.buyDate}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500">{h.accountName || "-"}</TableCell>
                  <TableCell className="text-right">{h.quantity.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{formatYen(h.buyPrice)}</TableCell>
                  <TableCell className="text-right">{formatYen(h.currentPrice)}</TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      (h.unrealizedPnl ?? 0) >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600"
                    }`}
                  >
                    {h.unrealizedPnl !== null
                      ? `${h.unrealizedPnl >= 0 ? "+" : ""}${formatYen(h.unrealizedPnl)}`
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">{formatYen(h.dividendIncome)}</TableCell>
                  <TableCell>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!confirm(`${h.name} を削除しますか？`)) return;
                        setHoldings((prev) => prev.filter((x) => x.id !== h.id));
                      }}
                      className="text-slate-400 hover:text-red-600"
                      aria-label="削除"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </TableCell>
                </TableRow>
                {expanded === h.id && (
                  <TableRow>
                    <TableCell colSpan={8} className="bg-slate-50 dark:bg-slate-950/40">
                      <DividendReceiptPanel
                        dividends={h.dividends}
                        onAdd={(receipt) =>
                          setHoldings((prev) =>
                            prev.map((x) =>
                              x.id === h.id ? { ...x, dividends: [...x.dividends, receipt] } : x
                            )
                          )
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
            {views.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-400 py-8">
                  保有銘柄が登録されていません
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent className={`text-xl font-semibold ${className ?? ""}`}>{value}</CardContent>
    </Card>
  );
}

function AddHoldingForm({
  stocks,
  onAdd,
}: {
  stocks: StockOption[];
  onAdd: (holding: StoredHolding) => void;
}) {
  const [code, setCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [buyDate, setBuyDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState("100");
  const [buyPrice, setBuyPrice] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    onAdd({
      id: crypto.randomUUID(),
      code: code.trim(),
      accountName: accountName.trim(),
      buyDate,
      quantity: Number(quantity),
      buyPrice: Number(buyPrice),
      note: note.trim(),
      dividends: [],
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>保有銘柄を追加</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>銘柄コード</Label>
          <Input list="stock-codes" value={code} onChange={(e) => setCode(e.target.value)} placeholder="例: 1414" />
          <datalist id="stock-codes">
            {stocks.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </datalist>
        </div>
        <div className="space-y-1">
          <Label>口座名 (任意)</Label>
          <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="例: SBI証券" />
        </div>
        <div className="space-y-1">
          <Label>購入日</Label>
          <Input type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>数量</Label>
          <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>購入単価</Label>
          <Input type="number" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>メモ (任意)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="sm:col-span-3">
          <Button onClick={submit} disabled={!code || !buyPrice || !quantity}>
            登録する
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DividendReceiptPanel({
  dividends,
  onAdd,
}: {
  dividends: StoredHolding["dividends"];
  onAdd: (receipt: StoredHolding["dividends"][number]) => void;
}) {
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amountPerShare, setAmountPerShare] = useState("");
  const [totalAmount, setTotalAmount] = useState("");

  function submit() {
    onAdd({
      id: crypto.randomUUID(),
      paidDate,
      amountPerShare: Number(amountPerShare),
      totalAmount: Number(totalAmount),
    });
    setAmountPerShare("");
    setTotalAmount("");
  }

  return (
    <div className="space-y-3 py-2" onClick={(e) => e.stopPropagation()}>
      <div className="text-sm font-medium">受取配当の記録</div>
      {dividends.length > 0 && (
        <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
          {dividends.map((d) => (
            <li key={d.id}>
              {d.paidDate}: 1株あたり{formatYen(d.amountPerShare)} / 合計 {formatYen(d.totalAmount)}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">受取日</Label>
          <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} className="h-8 w-36" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">1株配当</Label>
          <Input
            type="number"
            value={amountPerShare}
            onChange={(e) => setAmountPerShare(e.target.value)}
            className="h-8 w-28"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">受取合計額</Label>
          <Input
            type="number"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            className="h-8 w-32"
          />
        </div>
        <Button size="sm" onClick={submit} disabled={!amountPerShare || !totalAmount}>
          記録する
        </Button>
      </div>
    </div>
  );
}
