"use client";

import { formatUSD } from "@/lib/utils";
import { X, CheckCircle2 } from "lucide-react";

interface OrderDetailCardProps {
  order: {
    outcome: "YES" | "NO";
    amount: number;
    shares: number;
    price: number;
    fee: number;
    orderId?: string;
    timestamp?: string;
  };
  onClose: () => void;
}

export default function OrderDetailCard({ order, onClose }: OrderDetailCardProps) {
  const netAmount = order.amount - order.fee;

  return (
    <div className="bg-pm-card border border-pm-border rounded-xl p-6 mb-4 relative">
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1.5 hover:bg-pm-card-hover rounded-lg transition-colors"
        aria-label="关闭"
      >
        <X className="w-5 h-5 text-pm-text-dim" />
      </button>

      {/* 标题 */}
      <div className="flex items-center gap-2 mb-4 pr-8">
        <CheckCircle2 className="w-5 h-5 text-pm-green" />
        <h3 className="text-lg font-bold text-white">订单详情</h3>
      </div>

      {/* 订单信息 */}
      <div className="space-y-3">
        {/* 类型 */}
        <div className="flex items-center justify-between">
          <span className="text-pm-text-dim text-sm">类型</span>
          <span
            className={`px-3 py-1 rounded-lg text-sm font-bold ${
              order.outcome === "YES"
                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
            }`}
          >
            {order.outcome}
          </span>
        </div>

        {/* 成交价格 */}
        <div className="flex items-center justify-between">
          <span className="text-pm-text-dim text-sm">成交价格</span>
          <span className="text-white font-mono font-medium">{formatUSD(order.price)}</span>
        </div>

        {/* 成交份额 */}
        <div className="flex items-center justify-between">
          <span className="text-pm-text-dim text-sm">成交份额</span>
          <span className="text-white font-mono font-medium">{order.shares.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
        </div>

        {/* 投入金额 */}
        <div className="flex items-center justify-between">
          <span className="text-pm-text-dim text-sm">投入金额</span>
          <span className="text-white font-mono font-medium">{formatUSD(order.amount)}</span>
        </div>

        {/* 手续费 */}
        <div className="flex items-center justify-between">
          <span className="text-pm-text-dim text-sm">手续费</span>
          <span className="text-pm-text-dim font-mono">{formatUSD(order.fee)}</span>
        </div>

        {/* 分割线 */}
        <div className="border-t border-pm-border my-2"></div>

        {/* 净额 */}
        <div className="flex items-center justify-between">
          <span className="text-pm-text-dim text-sm">净投入</span>
          <span className="text-white font-mono font-bold">{formatUSD(netAmount)}</span>
        </div>

        {/* 订单ID（如果有） */}
        {order.orderId && (
          <div className="flex items-center justify-between pt-2 border-t border-pm-border">
            <span className="text-pm-text-dim text-xs">订单ID</span>
            <span className="text-pm-text-dim font-mono text-xs">{order.orderId}</span>
          </div>
        )}
      </div>
    </div>
  );
}

