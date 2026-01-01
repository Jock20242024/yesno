"use client";

import { Wallet } from "lucide-react";
import { formatUSD } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";

interface UserPosition {
  shares: number;
  avgPrice: number;
  currentPrice: number;
  outcome: "yes" | "no";
}

interface UserPositionCardProps {
  position: UserPosition | null;
  onSell: () => void;
  onSellClick?: () => void;
  marketTitle?: string;
  marketStatus?: "OPEN" | "RESOLVED";
  winningOutcome?: "YES" | "NO" | null;
}

export default function UserPositionCard({
  position,
  onSell,
  onSellClick,
  marketTitle,
  marketStatus = "OPEN",
  winningOutcome = null,
}: UserPositionCardProps) {
  const { t } = useLanguage();
  
  if (!position) {
    return null;
  }

  // 判定持仓结果
  const isResolved = marketStatus === "RESOLVED";
  const isWinner = isResolved && winningOutcome 
    ? (position.outcome === "yes" && winningOutcome === "YES") || 
      (position.outcome === "no" && winningOutcome === "NO")
    : false;
  const isLoser = isResolved && winningOutcome && !isWinner;

  // 计算价值和盈亏
  // 对于输家，当前价值强制为 $0.00
  const currentValue = isLoser ? 0 : position.shares * position.currentPrice;
  const totalCost = position.shares * position.avgPrice;
  const pnl = currentValue - totalCost;
  // 对于输家，盈亏百分比强制为 -100%
  const pnlPercent = isLoser ? -100 : (totalCost > 0 ? (pnl / totalCost) * 100 : 0);
  const isProfit = pnl >= 0;

  return (
    <div className={`bg-[#1A1A1A] rounded-xl border border-pm-border p-5 shadow-2xl mb-6 ${
      isLoser ? "opacity-75" : ""
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className={`w-5 h-5 ${isLoser ? "text-zinc-500" : "text-pm-green"}`} />
          <h3 className="text-white text-sm font-bold">{t('market.position.title')}</h3>
        </div>
        {/* 市场已结束时，根据输赢显示不同内容 */}
        {isResolved ? (
          <div className="flex items-center gap-2">
            {isWinner ? (
              <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                ✅ {t('market.position.won')}
              </span>
            ) : isLoser ? (
              <span className="px-3 py-1.5 rounded-lg bg-zinc-700/50 border border-zinc-600/30 text-zinc-400 text-xs font-bold">
                🗑️ {t('market.position.expired')}
              </span>
            ) : null}
          </div>
        ) : (
          <button
            onClick={onSellClick || onSell}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-bold transition-all border border-zinc-700"
          >
            {t('market.position.sell')}
          </button>
        )}
      </div>

      {/* 状态标签（仅在市场已结束时显示） */}
      {isResolved && (
        <div className="mb-4">
          {isWinner ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-emerald-400 text-xs font-bold">{t('market.position.redeemable')}</span>
            </div>
          ) : isLoser ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/30">
              <span className="text-zinc-500 text-xs font-bold">{t('market.position.zeroed')}</span>
            </div>
          ) : null}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* 持有份额 */}
        <div className="flex flex-col gap-1">
          <span className="text-zinc-500 text-xs font-medium">{t('market.position.shares')}</span>
          <span className={`font-mono font-bold text-sm ${
            isLoser ? "text-zinc-500" : "text-emerald-500"
          }`}>
            {position.shares.toLocaleString()} {position.outcome === "yes" ? "Yes" : "No"}
          </span>
        </div>

        {/* 平均买入价 */}
        <div className="flex flex-col gap-1">
          <span className="text-zinc-500 text-xs font-medium">{t('market.position.avg_price')}</span>
          <span className={`font-mono font-bold text-sm ${
            isLoser ? "text-zinc-500" : "text-white"
          }`}>
            {formatUSD(position.avgPrice)}
          </span>
        </div>

        {/* 🔥 总成本 (Total Cost) */}
        <div className="flex flex-col gap-1">
          <span className="text-zinc-500 text-xs font-medium">{t('market.position.total_cost')}</span>
          <span className={`font-mono font-bold text-sm ${
            isLoser ? "text-zinc-500" : "text-white"
          }`}>
            {formatUSD(totalCost)}
          </span>
        </div>

        {/* 当前价值 */}
        <div className="flex flex-col gap-1">
          <span className="text-zinc-500 text-xs font-medium">{t('market.position.current_value')}</span>
          <span className={`font-mono font-bold text-sm ${
            isLoser ? "text-zinc-500" : "text-white"
          }`}>
            {formatUSD(currentValue)}
          </span>
        </div>

        {/* 盈亏 */}
        <div className="flex flex-col gap-1">
          <span className="text-zinc-500 text-xs font-medium">{t('market.position.pnl')}</span>
          <span
            className={`font-mono font-bold text-sm ${
              isLoser 
                ? "text-zinc-500" 
                : isProfit 
                  ? "text-emerald-500" 
                  : "text-rose-500"
            }`}
          >
            {isProfit && !isLoser ? "+" : ""}
            {formatUSD(pnl)} ({isProfit && !isLoser ? "+" : ""}
            {pnlPercent.toFixed(1)}%)
          </span>
        </div>
      </div>
    </div>
  );
}
