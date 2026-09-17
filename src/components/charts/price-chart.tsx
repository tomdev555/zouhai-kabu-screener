"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type Time,
} from "lightweight-charts";

export interface PriceBarPoint {
  time: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function PriceChart({ data }: { data: PriceBarPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height: 380,
      layout: {
        background: { color: "transparent" },
        textColor: "#475569",
      },
      grid: {
        vertLines: { color: "#e2e8f0" },
        horzLines: { color: "#e2e8f0" },
      },
      timeScale: { timeVisible: false, borderColor: "#cbd5e1" },
      rightPriceScale: { borderColor: "#cbd5e1" },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#dc2626",
      downColor: "#2563eb",
      borderVisible: false,
      wickUpColor: "#dc2626",
      wickDownColor: "#2563eb",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      color: "#94a3b8",
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    candleSeries.setData(
      data.map((d) => ({
        time: d.time as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    );

    volumeSeries.setData(
      data.map((d) => ({
        time: d.time as Time,
        value: d.volume,
        color: d.close >= d.open ? "#fca5a5" : "#93c5fd",
      }))
    );

    chart.timeScale().fitContent();

    const resize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      chart.remove();
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex h-[380px] items-center justify-center text-sm text-slate-400">
        価格データがありません
      </div>
    );
  }

  return <div ref={containerRef} className="w-full" />;
}
