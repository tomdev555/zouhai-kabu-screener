"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface EpsDividendPoint {
  fiscalYear: number;
  eps: number | null;
  dividendPerShare: number | null;
  isSpecial: boolean;
}

export function EpsDividendChart({ data }: { data: EpsDividendPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-slate-400">
        財務データがありません
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={288}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="fiscalYear" tick={{ fontSize: 12 }} />
        <YAxis yAxisId="div" tick={{ fontSize: 12 }} width={48} />
        <YAxis yAxisId="eps" orientation="right" tick={{ fontSize: 12 }} width={48} />
        <Tooltip
          formatter={(value, name) => [
            `${value}円`,
            name === "dividendPerShare" ? "1株配当" : "EPS",
          ]}
          labelFormatter={(l) => `${l}年度`}
        />
        <Bar yAxisId="div" dataKey="dividendPerShare" name="1株配当" barSize={20}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.isSpecial ? "#f59e0b" : "#10b981"} />
          ))}
        </Bar>
        <Line
          yAxisId="eps"
          type="monotone"
          dataKey="eps"
          name="EPS"
          stroke="#2563eb"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
