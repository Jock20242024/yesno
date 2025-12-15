"use client";

import { Share2 } from "lucide-react";

interface PositionRowProps {
  eventTitle: string;
  type: "YES" | "NO";
  investedAmount: string;
  buyPrice: string;
  purchaseTime: string;
  profitAndLoss: string;
  onShare?: () => void;
}

export default function PositionRow({
  eventTitle,
  type,
  investedAmount,
  buyPrice,
  purchaseTime,
  profitAndLoss,
  onShare,
}: PositionRowProps) {
  // 判断盈亏是正数还是负数
  const isProfit = profitAndLoss.startsWith("+");
  const pnlColor = isProfit ? "text-emerald-500" : "text-rose-500";

  return (
    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_0.5fr] items-center gap-4 py-4 px-4 rounded-lg bg-pm-card border border-white/10 hover:bg-white/[0.02] transition-all">
      {/* 事件标题 */}
      <div className="min-w-0">
        <h4 className="text-sm font-bold text-white leading-tight line-clamp-2">
          {eventTitle}
        </h4>
      </div>

      {/* 类型标签 */}
      <div>
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
            type === "YES"
              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
              : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
          }`}
        >
          {type}
        </span>
      </div>

      {/* 下注金额 - 右对齐 */}
      <div className="text-right">
        <div className="text-xs text-zinc-500 md:hidden mb-0.5">本金</div>
        <div className="text-sm font-bold text-zinc-100 font-mono tabular-nums">
          {investedAmount}
        </div>
      </div>

      {/* 买入价格 - 右对齐 */}
      <div className="text-right">
        <div className="text-xs text-zinc-500 md:hidden mb-0.5">价格</div>
        <div className="text-sm font-medium text-zinc-600 font-mono tabular-nums">
          {buyPrice}
        </div>
      </div>

      {/* 购买时间 - 右对齐 */}
      <div className="text-right">
        <div className="text-xs text-zinc-500 md:hidden mb-0.5">时间</div>
        <div className="text-xs text-zinc-500">
          {purchaseTime}
        </div>
      </div>

      {/* 盈亏 - 右对齐 */}
      <div className="text-right">
        <div className="text-xs text-zinc-500 md:hidden mb-0.5">盈亏</div>
        <div className={`text-sm font-bold font-mono tabular-nums ${pnlColor}`}>
          {profitAndLoss}
        </div>
      </div>

      {/* 操作列 - 居中对齐 */}
      <div className="flex items-center justify-center">
        {onShare && (
          <button
            onClick={onShare}
            className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-all"
            title="分享持仓"
          >
            <Share2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

