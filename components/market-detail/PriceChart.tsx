"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { TrendingUp, Globe } from "lucide-react";
import type { MarketStatus, MarketResult } from "./MarketHeader";

interface PriceChartProps {
  yesPercent: number;
  marketStatus?: MarketStatus;
  marketResult?: MarketResult;
}

// Mock data for the chart
const generateChartData = () => {
  const data = [];
  const now = Date.now();
  const hours = 24;
  
  for (let i = hours; i >= 0; i--) {
    const time = new Date(now - i * 60 * 60 * 1000);
    // Simulate price movement around 65%
    const baseValue = 0.65;
    const variation = (Math.sin(i / 3) * 0.1) + (Math.random() * 0.05);
    const value = Math.max(0.3, Math.min(0.9, baseValue + variation));
    
    data.push({
      time: time.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      value: value,
      timestamp: time.getTime(),
    });
  }
  
  return data;
};

export default function PriceChart({ yesPercent, marketStatus = "open", marketResult = null }: PriceChartProps) {
  const chartData = generateChartData();
  const currentValue = yesPercent / 100;
  const isResolved = marketStatus === "closed" && marketResult !== null;
  
  // 在图表数据中找到结束时间点（假设是最后一个数据点）
  const resolvedTimeIndex = chartData.length - 1;

  return (
    <div className="mb-10">
      <div className="flex items-baseline gap-3 mb-2">
        <span className="text-5xl md:text-6xl font-black text-pm-green tracking-tight">
          {yesPercent}%
        </span>
        <span className="text-xl font-bold text-pm-green">Yes</span>
        <span className="flex items-center text-sm font-bold text-pm-green bg-pm-green-dim px-2 py-0.5 rounded ml-2">
          <TrendingUp className="w-4 h-4 mr-0.5" />
          +5.2% (24h)
        </span>
      </div>
      <div className="h-[350px] md:h-[400px] lg:h-[500px] w-full relative group cursor-crosshair border-b border-pm-border">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="colorYes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d323b" />
            <XAxis
              dataKey="time"
              stroke="#828a99"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0.3, 0.9]}
              stroke="#828a99"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1c2027",
                border: "1px solid #2d323b",
                borderRadius: "8px",
                color: "#f3f4f6",
              }}
              formatter={(value: number) => [`${(value * 100).toFixed(1)}% Yes`, ""]}
              labelFormatter={(label) => `时间: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#22c55e"
              strokeWidth={2.5}
              fill="url(#colorYes)"
            />
            {isResolved && (
              <ReferenceLine
                x={chartData[resolvedTimeIndex]?.time}
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{
                  value: "结束时间",
                  position: "top",
                  fill: "#ef4444",
                  fontSize: 12,
                  fontWeight: "bold",
                }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
        <div className="absolute top-4 left-[65%] bg-pm-card border border-pm-border px-3 py-2 rounded-lg shadow-xl hidden group-hover:block z-10">
          <div className="text-[10px] text-pm-text-dim mb-0.5 font-medium uppercase tracking-wider">
            12月 24, 10:00 PM
          </div>
          <div className="text-lg font-bold text-pm-green leading-none">
            {yesPercent}% Yes
          </div>
        </div>
      </div>
      <div className="flex justify-between items-center pt-3">
        <div className="flex gap-1 p-1 bg-pm-card rounded-lg border border-pm-border">
          <button className="px-3 py-1 rounded-md hover:bg-pm-card-hover text-xs font-bold text-pm-text-dim hover:text-white transition-colors">
            1H
          </button>
          <button className="px-3 py-1 rounded-md hover:bg-pm-card-hover text-xs font-bold text-pm-text-dim hover:text-white transition-colors">
            6H
          </button>
          <button className="px-3 py-1 rounded-md bg-pm-card-hover text-xs font-bold text-white shadow-sm border border-white/5">
            1D
          </button>
          <button className="px-3 py-1 rounded-md hover:bg-pm-card-hover text-xs font-bold text-pm-text-dim hover:text-white transition-colors">
            1W
          </button>
          <button className="px-3 py-1 rounded-md hover:bg-pm-card-hover text-xs font-bold text-pm-text-dim hover:text-white transition-colors">
            1M
          </button>
          <button className="px-3 py-1 rounded-md hover:bg-pm-card-hover text-xs font-bold text-pm-text-dim hover:text-white transition-colors">
            全部
          </button>
        </div>
        <div className="text-xs font-medium text-pm-text-dim flex items-center gap-1.5 bg-pm-card px-2 py-1 rounded border border-pm-border">
          <Globe className="w-[14px] h-[14px]" />
          UTC+8
        </div>
      </div>
    </div>
  );
}

