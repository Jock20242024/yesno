"use client";

import { formatUSD } from "@/lib/utils";
import Link from "next/link";

export interface Position {
  id: number;
  marketId: number;
  marketTitle: string;
  marketImageUrl?: string;
  outcome: "yes" | "no";
  shares: number;
  avgPrice: number;
  currentValue: number;
  profitAndLoss: number;
}

interface PositionsTableProps {
  positions: Position[];
}

export default function PositionsTable({ positions }: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl mb-4">📊</div>
        <p className="text-zinc-500 text-sm">您还没有任何持仓</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* 表头 */}
      <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] items-center gap-4 py-3 px-4 rounded-lg bg-pm-bg border border-white/10 mb-1">
        <div className="min-w-0">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            事件 (Market)
          </span>
        </div>
        <div>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            类型 (Outcome)
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            持有份额 (Shares)
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            平均均价 (Avg Price)
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            当前价值 (Value)
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            盈亏 (P&L)
          </span>
        </div>
      </div>

      {/* 持仓列表 */}
      <div className="space-y-1">
        {positions.map((position) => {
          const isProfit = position.profitAndLoss >= 0;
          const pnlPercent = position.avgPrice > 0 
            ? (position.profitAndLoss / (position.shares * position.avgPrice)) * 100 
            : 0;

          return (
            <div
              key={position.id}
              className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] items-center gap-4 py-4 px-4 rounded-lg bg-pm-card border border-white/10 hover:bg-white/[0.02] transition-all"
            >
              {/* 市场 */}
              <div className="min-w-0">
                <div className="text-xs text-zinc-500 md:hidden mb-0.5">事件</div>
                <Link
                  href={`/markets/${position.marketId}`}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  {position.marketImageUrl && (
                    <img
                      src={position.marketImageUrl}
                      alt={position.marketTitle}
                      className="w-8 h-8 rounded-md object-cover flex-shrink-0"
                    />
                  )}
                  <span className="text-sm font-bold text-zinc-100 line-clamp-1">
                    {position.marketTitle}
                  </span>
                </Link>
              </div>

              {/* 类型 */}
              <div>
                <div className="text-xs text-zinc-500 md:hidden mb-0.5">类型</div>
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                    position.outcome === "yes"
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                  }`}
                >
                  {position.outcome === "yes" ? "Yes" : "No"}
                </span>
              </div>

              {/* 持有份额 */}
              <div className="text-right">
                <div className="text-xs text-zinc-500 md:hidden mb-0.5">持有份额</div>
                <div className="text-sm font-bold text-zinc-100 font-mono tabular-nums">
                  {position.shares.toLocaleString()}
                </div>
              </div>

              {/* 平均均价 */}
              <div className="text-right">
                <div className="text-xs text-zinc-500 md:hidden mb-0.5">平均均价</div>
                <div className="text-sm font-medium text-zinc-100 font-mono tabular-nums">
                  {/* 🔥 修复：优先使用costBasis（实际投入金额）计算avgPrice，确保账目自洽 */}
                  {formatUSD(
                    (position as any).costBasis && (position as any).costBasis > 0 && position.shares > 0
                      ? (position as any).costBasis / position.shares
                      : position.avgPrice
                  )}
                </div>
              </div>

              {/* 当前价值 */}
              <div className="text-right">
                <div className="text-xs text-zinc-500 md:hidden mb-0.5">当前价值</div>
                <div className="text-sm font-bold text-zinc-100 font-mono tabular-nums">
                  {formatUSD(position.currentValue)}
                </div>
              </div>

              {/* 盈亏 */}
              <div className="text-right">
                <div className="text-xs text-zinc-500 md:hidden mb-0.5">盈亏</div>
                <div className={`text-sm font-bold font-mono tabular-nums ${
                  isProfit ? "text-emerald-500" : "text-rose-500"
                }`}>
                  {isProfit ? "+" : ""}
                  {formatUSD(position.profitAndLoss)}
                  <span className="text-xs font-medium ml-1">
                    ({isProfit ? "+" : ""}{pnlPercent.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

