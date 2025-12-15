"use client";

import { formatUSD } from "@/lib/utils";
import { ArrowDownCircle, ArrowUpCircle, CheckCircle, Clock, ExternalLink } from "lucide-react";

export interface FundingRecord {
  id: number;
  type: "deposit" | "withdraw";
  amount: number;
  network: string;
  status: "completed" | "pending" | "failed";
  timestamp: string;
  txHash?: string;
}

interface FundingTableProps {
  records: FundingRecord[];
}

export default function FundingTable({ records }: FundingTableProps) {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl mb-4">💳</div>
        <p className="text-zinc-500 text-sm">暂无资金记录</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    if (status === "completed") {
      return (
        <div className="flex items-center gap-1.5 text-xs">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-emerald-500 font-medium">成功</span>
        </div>
      );
    }
    if (status === "pending") {
      return (
        <div className="flex items-center gap-1.5 text-xs">
          <Clock className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-amber-500 font-medium">处理中</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <Clock className="w-3.5 h-3.5 text-rose-500" />
        <span className="text-rose-500 font-medium">失败</span>
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {/* 表头 */}
      <div className="hidden md:grid grid-cols-[1fr_1.5fr_1fr_1fr_1fr_0.6fr] items-center gap-4 py-3 px-4 rounded-lg bg-pm-bg border border-white/10 mb-1">
        <div>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            类型 (Type)
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            金额 (Amount)
          </span>
        </div>
        <div>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            网络 (Network)
          </span>
        </div>
        <div className="text-center">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            状态 (Status)
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            时间 (Time)
          </span>
        </div>
        <div className="text-center">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            交易哈希
          </span>
        </div>
      </div>

      {/* 资金记录列表 */}
      <div className="space-y-1">
        {records.map((record) => (
          <div
            key={record.id}
            className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_1fr_1fr_1fr_0.6fr] items-center gap-4 py-4 px-4 rounded-lg bg-pm-card border border-white/10 hover:bg-white/[0.02] transition-all"
          >
            {/* 类型 */}
            <div>
              <div className="text-xs text-zinc-500 md:hidden mb-0.5">类型</div>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                  record.type === "deposit"
                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                }`}
              >
                {record.type === "deposit" ? (
                  <ArrowDownCircle className="w-3 h-3" />
                ) : (
                  <ArrowUpCircle className="w-3 h-3" />
                )}
                {record.type === "deposit" ? "充值" : "提现"}
              </span>
            </div>

            {/* 金额 */}
            <div className="text-right">
              <div className="text-xs text-zinc-500 md:hidden mb-0.5">金额</div>
              <div
                className={`text-sm font-bold font-mono tabular-nums ${
                  record.type === "deposit"
                    ? "text-emerald-500"
                    : "text-zinc-100"
                }`}
              >
                {record.type === "deposit" ? "+" : "-"}
                {formatUSD(record.amount)}
              </div>
            </div>

            {/* 网络 */}
            <div>
              <div className="text-xs text-zinc-500 md:hidden mb-0.5">网络</div>
              <div className="text-sm font-medium text-zinc-100">
                {record.network}
              </div>
            </div>

            {/* 状态 */}
            <div className="flex items-center justify-center md:justify-start">
              <div className="text-xs text-zinc-500 md:hidden mb-0.5">状态</div>
              {getStatusBadge(record.status)}
            </div>

            {/* 时间 */}
            <div className="text-right">
              <div className="text-xs text-zinc-500 md:hidden mb-0.5">时间</div>
              <div className="text-xs text-zinc-600 font-mono">
                {record.timestamp}
              </div>
            </div>

            {/* 交易哈希 */}
            <div className="flex items-center justify-center">
              <div className="text-xs text-zinc-500 md:hidden mb-0.5">交易哈希</div>
              {record.txHash ? (
                <a
                  href={`https://etherscan.io/tx/${record.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  title="在 Etherscan 查看"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden md:inline font-mono">
                    {record.txHash.slice(0, 6)}...{record.txHash.slice(-4)}
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

