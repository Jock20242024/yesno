"use client";

import { ExternalLink, CheckCircle, XCircle } from "lucide-react";
import { formatUSD } from "@/lib/utils";
import Link from "next/link";

export interface OrderHistoryItem {
  id: number;
  timestamp: string;
  marketId: number;
  marketTitle: string;
  marketImageUrl?: string;
  action: "buy" | "sell" | "redeem";
  outcome: "yes" | "no";
  price: number;
  shares: number;
  value: number;
  status: "success" | "failed";
  txHash?: string;
}

interface OrderHistoryTableProps {
  orders: OrderHistoryItem[];
}

export default function OrderHistoryTable({ orders }: OrderHistoryTableProps) {
  const getActionBadge = (action: string, outcome?: "yes" | "no") => {
    if (action === "buy") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          买入 {outcome === "yes" ? "Yes" : "No"}
        </span>
      );
    }
    if (action === "sell") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
          卖出 {outcome === "yes" ? "Yes" : "No"}
        </span>
      );
    }
    if (action === "redeem") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
          领取奖励
        </span>
      );
    }
    return null;
  };

  const getStatusBadge = (status: string) => {
    if (status === "success") {
      return (
        <div className="flex items-center gap-1.5 text-xs">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-emerald-500 font-medium">成功</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <XCircle className="w-3.5 h-3.5 text-rose-500" />
        <span className="text-rose-500 font-medium">失败</span>
      </div>
    );
  };

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl mb-4">📊</div>
        <p className="text-zinc-500 text-sm">暂无交易记录</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* 表头 - 使用 Grid 布局 */}
      <div className="hidden md:grid grid-cols-[1.2fr_1.2fr_1fr_1fr_1fr_1fr_0.8fr_0.6fr] items-center gap-4 py-3 px-4 rounded-lg bg-pm-bg border border-white/10 mb-1">
        <div className="min-w-0">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            时间
          </span>
        </div>
        <div className="min-w-0">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            市场
          </span>
        </div>
        <div>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            操作
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            价格
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            数量
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            总额
          </span>
        </div>
        <div className="text-center">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            状态
          </span>
        </div>
        <div className="text-center">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            交易哈希
          </span>
        </div>
      </div>

      {/* 交易记录列表 */}
      <div className="space-y-1">
        {orders.map((order) => (
          <div
            key={order.id}
            className="grid grid-cols-1 md:grid-cols-[1.2fr_1.2fr_1fr_1fr_1fr_1fr_0.8fr_0.6fr] items-center gap-4 py-4 px-4 rounded-lg bg-pm-card border border-white/10 hover:bg-white/[0.02] transition-all"
          >
            {/* 时间 */}
            <div className="min-w-0">
              <div className="text-xs text-zinc-500 md:hidden mb-0.5">时间</div>
              <div className="text-xs text-zinc-600 font-mono">
                {order.timestamp}
              </div>
            </div>

            {/* 市场 */}
            <div className="min-w-0">
              <div className="text-xs text-zinc-500 md:hidden mb-0.5">市场</div>
              <Link
                href={`/markets/${order.marketId}`}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                {order.marketImageUrl && (
                  <img
                    src={order.marketImageUrl}
                    alt={order.marketTitle}
                    className="w-8 h-8 rounded-md object-cover flex-shrink-0"
                  />
                )}
                <span className="text-sm font-bold text-zinc-100 line-clamp-1">
                  {order.marketTitle}
                </span>
              </Link>
            </div>

            {/* 操作 */}
            <div>
              <div className="text-xs text-zinc-500 md:hidden mb-0.5">操作</div>
              {getActionBadge(order.action, order.outcome)}
            </div>

            {/* 价格 */}
            <div className="text-right">
              <div className="text-xs text-zinc-500 md:hidden mb-0.5">价格</div>
              <div className="text-sm font-bold text-zinc-100 font-mono tabular-nums">
                {formatUSD(order.price)}
              </div>
            </div>

            {/* 数量 */}
            <div className="text-right">
              <div className="text-xs text-zinc-500 md:hidden mb-0.5">数量</div>
              <div className="text-sm font-bold text-zinc-100 font-mono tabular-nums">
                {order.shares.toLocaleString()}{" "}
                {order.action !== "redeem" && (
                  <span className="text-xs text-zinc-500">
                    {order.outcome === "yes" ? "Yes" : "No"}
                  </span>
                )}
              </div>
            </div>

            {/* 总额 */}
            <div className="text-right">
              <div className="text-xs text-zinc-500 md:hidden mb-0.5">总额</div>
              <div className="text-sm font-bold text-zinc-100 font-mono tabular-nums">
                {formatUSD(order.value)}
              </div>
            </div>

            {/* 状态 */}
            <div className="flex items-center justify-center md:justify-start">
              <div className="text-xs text-zinc-500 md:hidden mb-0.5">状态</div>
              {getStatusBadge(order.status)}
            </div>

            {/* 交易哈希 */}
            <div className="flex items-center justify-center">
              <div className="text-xs text-zinc-500 md:hidden mb-0.5">交易哈希</div>
              {order.txHash ? (
                <a
                  href={`https://etherscan.io/tx/${order.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  title="在 Etherscan 查看"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden md:inline font-mono">
                    {order.txHash.slice(0, 6)}...{order.txHash.slice(-4)}
                  </span>
                </a>
              ) : (
                <span className="text-xs text-zinc-600">-</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

