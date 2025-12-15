"use client";

import { Activity } from "lucide-react";

export default function MarketOverview() {
  return (
    <div className="overflow-hidden rounded-xl border border-border-dark bg-surface-dark/50 backdrop-blur-sm shadow-xl">
      <div className="p-5">
        <h3 className="text-white text-sm font-bold mb-5 flex items-center gap-2 uppercase tracking-wider">
          <Activity className="w-4 h-4 text-primary animate-pulse" />
          预测市场实时数据
        </h3>
        <div className="flex flex-col gap-0">
          {/* 24H 交易量 */}
          <div className="flex justify-between items-center py-4 border-b border-border-dark/50">
            <span className="text-text-secondary text-xs font-medium">24H 交易量</span>
            <span className="text-emerald-500 font-mono font-bold text-sm animate-pulse">
              $12,450,200
            </span>
          </div>

          {/* 全网持仓量 (Open Interest) */}
          <div className="flex justify-between items-center py-4 border-b border-border-dark/50">
            <span className="text-text-secondary text-xs font-medium">全网持仓量</span>
            <span className="text-white font-mono font-bold text-sm">
              $8.5M
            </span>
          </div>

          {/* 总锁仓量 (TVL) */}
          <div className="flex justify-between items-center py-4 border-b border-border-dark/50">
            <span className="text-text-secondary text-xs font-medium">总锁仓量 (TVL)</span>
            <span className="text-white font-mono font-bold text-sm">
              $45.2M
            </span>
          </div>

          {/* 24H 活跃交易者 */}
          <div className="flex justify-between items-center py-4 border-b border-border-dark/50">
            <span className="text-text-secondary text-xs font-medium">24H 活跃交易者</span>
            <span className="text-white font-mono font-bold text-sm">
              1,204
            </span>
          </div>

          {/* 进行中事件 */}
          <div className="flex justify-between items-center py-4">
            <span className="text-text-secondary text-xs font-medium">进行中事件</span>
            <span className="text-white font-mono font-bold text-sm">
              226
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

