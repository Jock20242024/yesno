"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatUSD } from "@/lib/utils";

type TimeRange = "1D" | "1W" | "1M" | "1Y";

interface PnLData {
  amount: number;
  percentage: number;
}

const mockPnLData: Record<TimeRange, PnLData> = {
  "1D": { amount: 15.0, percentage: 0.5 },
  "1W": { amount: -50.0, percentage: -1.2 },
  "1M": { amount: 150.0, percentage: 5.2 },
  "1Y": { amount: 850.0, percentage: 12.8 },
};

export default function PnLSummary() {
  const [selectedRange, setSelectedRange] = useState<TimeRange>("1M");
  const data = mockPnLData[selectedRange];
  const isProfit = data.amount >= 0;
  const colorClass = isProfit ? "text-emerald-500" : "text-rose-500";

  return (
    <div className="bg-pm-card rounded-xl border border-white/10 p-6 shadow-2xl">
      {/* 时间维度选择按钮 */}
      <div className="flex gap-2 mb-6">
        {(["1D", "1W", "1M", "1Y"] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setSelectedRange(range)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border ${
              selectedRange === range
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-lg shadow-emerald-500/20"
                : "bg-pm-bg text-zinc-500 hover:text-zinc-100 hover:bg-white/[0.02] border-white/10"
            }`}
          >
            {range}
          </button>
        ))}
      </div>

      {/* 盈亏数据展示 */}
      <div className="flex items-baseline gap-4">
        <div className="flex items-baseline gap-2">
          {isProfit ? (
            <TrendingUp className="w-6 h-6 text-emerald-500" />
          ) : (
            <TrendingDown className="w-6 h-6 text-rose-500" />
          )}
          <div>
            <div className={`text-4xl font-black ${colorClass} font-mono tabular-nums`}>
              {isProfit ? "+" : ""}
              {formatUSD(data.amount)}
            </div>
            <div className={`text-lg font-bold ${colorClass} font-mono tabular-nums mt-1`}>
              {isProfit ? "+" : ""}
              {data.percentage.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

