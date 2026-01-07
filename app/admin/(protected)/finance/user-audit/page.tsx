"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

interface FundFlow {
  deposits: number;
  withdrawals: number;
  netDeposits: number;
  transactionSum: number;
  theoreticalBalance: number;
  actualBalance: number;
  balanceDifference: number;
  isBalanceCorrect: boolean;
  totalOrderAmount: number;
  totalFeeDeducted: number;
  totalNetAmount: number;
  totalPositionCost: number;
  totalPositionValue: number;
  totalAssets: number;
}

interface AuditData {
  user: {
    id: string;
    email: string;
    balance: number;
    createdAt: string;
  };
  fundFlow: FundFlow;
  transactions: Array<{
    id: string;
    amount: number;
    type: string;
    reason: string | null;
    status: string;
    createdAt: string;
  }>;
  orders: Array<{
    id: string;
    marketId: string;
    outcomeSelection: string;
    amount: number;
    feeDeducted: number;
    netAmount: number;
    filledAmount: number;
    limitPrice: number | null;
    orderType: string;
    status: string;
    createdAt: string;
  }>;
  positions: Array<{
    id: string;
    marketId: string;
    marketTitle: string;
    outcome: string;
    shares: number;
    avgPrice: number;
    cost: number;
    costByAvgPrice?: number;
    currentPrice: number;
    currentValue: number;
    pnl: number;
    marketStatus: string;
    resolvedOutcome: string | null;
    actualInvestedAmount: number;
    costVsInvestedDifference: number;
    isCostCorrect: boolean;
  }>;
  deposits: Array<{
    id: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
  withdrawals: Array<{
    id: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
}

export default function UserAuditPage() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const userEmail = searchParams.get("email");
  
  const [auditData, setAuditData] = useState<AuditData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(userEmail || userId || "");

  const fetchAudit = async () => {
    if (!searchInput.trim()) {
      toast.error("请输入用户ID或邮箱");
      return;
    }

    setIsLoading(true);
    try {
      const isEmail = searchInput.includes("@");
      const url = isEmail
        ? `/api/admin/finance/user-audit?email=${encodeURIComponent(searchInput)}`
        : `/api/admin/finance/user-audit?userId=${encodeURIComponent(searchInput)}`;

      const response = await fetch(url);
      const result = await response.json();

      if (!result.success) {
        toast.error(result.error || "审计失败");
        return;
      }

      setAuditData(result.data);
    } catch (error: any) {
      console.error("审计失败:", error);
      toast.error("审计失败: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN");
  };

  if (!auditData) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-4">用户资金流向审计</h1>
          <div className="flex gap-4">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="输入用户ID或邮箱"
              className="px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 flex-1"
              onKeyPress={(e) => e.key === "Enter" && fetchAudit()}
            />
            <button
              onClick={fetchAudit}
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "审计中..." : "开始审计"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { user, fundFlow, transactions, orders, positions, deposits, withdrawals } = auditData;

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-4">用户资金流向审计</h1>
        <div className="flex gap-4">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="输入用户ID或邮箱"
            className="px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 flex-1"
            onKeyPress={(e) => e.key === "Enter" && fetchAudit()}
          />
          <button
            onClick={fetchAudit}
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "审计中..." : "重新审计"}
          </button>
        </div>
      </div>

      {/* 用户信息 */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">用户信息</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-gray-400 text-sm">用户ID</p>
            <p className="text-white font-mono">{user.id}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">邮箱</p>
            <p className="text-white">{user.email}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">当前余额</p>
            <p className="text-white font-mono text-lg">{formatUSD(user.balance)}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">注册时间</p>
            <p className="text-white">{formatDate(user.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* 资金流向汇总 */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">资金流向汇总</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`p-4 rounded-lg ${fundFlow.isBalanceCorrect ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
            <p className="text-gray-400 text-sm">余额验证</p>
            <p className={`text-lg font-bold ${fundFlow.isBalanceCorrect ? 'text-green-400' : 'text-red-400'}`}>
              {fundFlow.isBalanceCorrect ? "✓ 正确" : "✗ 异常"}
            </p>
            <p className="text-gray-500 text-xs">
              差异: {formatUSD(Math.abs(fundFlow.balanceDifference))}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-gray-700/50">
            <p className="text-gray-400 text-sm">充值总额</p>
            <p className="text-white text-lg font-bold">{formatUSD(fundFlow.deposits)}</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-700/50">
            <p className="text-gray-400 text-sm">提现总额</p>
            <p className="text-white text-lg font-bold">{formatUSD(fundFlow.withdrawals)}</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-700/50">
            <p className="text-gray-400 text-sm">净充值</p>
            <p className="text-white text-lg font-bold">{formatUSD(fundFlow.netDeposits)}</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-700/50">
            <p className="text-gray-400 text-sm">交易总额</p>
            <p className="text-white text-lg font-bold">{formatUSD(fundFlow.transactionSum)}</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-700/50">
            <p className="text-gray-400 text-sm">理论余额</p>
            <p className="text-white text-lg font-bold">{formatUSD(fundFlow.theoreticalBalance)}</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-700/50">
            <p className="text-gray-400 text-sm">实际余额</p>
            <p className="text-white text-lg font-bold">{formatUSD(fundFlow.actualBalance)}</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-700/50">
            <p className="text-gray-400 text-sm">订单总额</p>
            <p className="text-white text-lg font-bold">{formatUSD(fundFlow.totalOrderAmount)}</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-700/50">
            <p className="text-gray-400 text-sm">手续费总额</p>
            <p className="text-white text-lg font-bold">{formatUSD(fundFlow.totalFeeDeducted)}</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-700/50">
            <p className="text-gray-400 text-sm">净投资额（所有订单）</p>
            <p className="text-white text-lg font-bold">{formatUSD(fundFlow.totalNetAmount)}</p>
          </div>
          {fundFlow.totalFilledNetAmount !== undefined && (
            <div className="p-4 rounded-lg bg-green-900/30">
              <p className="text-gray-400 text-sm">已成交净投资额</p>
              <p className="text-green-400 text-lg font-bold">{formatUSD(fundFlow.totalFilledNetAmount)}</p>
            </div>
          )}
          {fundFlow.totalPendingNetAmount !== undefined && fundFlow.totalPendingNetAmount > 0 && (
            <div className="p-4 rounded-lg bg-yellow-900/30">
              <p className="text-gray-400 text-sm">未成交净投资额</p>
              <p className="text-yellow-400 text-lg font-bold">{formatUSD(fundFlow.totalPendingNetAmount)}</p>
            </div>
          )}
          <div className="p-4 rounded-lg bg-gray-700/50">
            <p className="text-gray-400 text-sm">持仓总投入</p>
            <p className="text-white text-lg font-bold">{formatUSD(fundFlow.totalPositionCost)}</p>
            {fundFlow.positionCostVsFilledNetAmount && (
              <p className={`text-xs mt-1 ${fundFlow.positionCostVsFilledNetAmount.isConsistent ? 'text-green-400' : 'text-red-400'}`}>
                {fundFlow.positionCostVsFilledNetAmount.isConsistent ? '✓ 与已成交订单一致' : `✗ 差异: ${formatUSD(Math.abs(fundFlow.positionCostVsFilledNetAmount.difference))}`}
              </p>
            )}
          </div>
          <div className="p-4 rounded-lg bg-gray-700/50">
            <p className="text-gray-400 text-sm">持仓总价值</p>
            <p className="text-white text-lg font-bold">{formatUSD(fundFlow.totalPositionValue)}</p>
          </div>
          <div className="p-4 rounded-lg bg-blue-900/30">
            <p className="text-gray-400 text-sm">总资产</p>
            <p className="text-blue-400 text-lg font-bold">{formatUSD(fundFlow.totalAssets)}</p>
          </div>
        </div>
      </div>

      {/* 持仓详情 */}
      {positions.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">持仓详情 ({positions.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left p-2 text-gray-400">市场</th>
                  <th className="text-right p-2 text-gray-400">方向</th>
                  <th className="text-right p-2 text-gray-400">份额</th>
                  <th className="text-right p-2 text-gray-400">平均价</th>
                  <th className="text-right p-2 text-gray-400">投入成本</th>
                  <th className="text-right p-2 text-gray-400">当前价</th>
                  <th className="text-right p-2 text-gray-400">当前价值</th>
                  <th className="text-right p-2 text-gray-400">盈亏</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => (
                  <tr key={pos.id} className="border-b border-gray-700/50">
                    <td className="p-2 text-white">{pos.marketTitle}</td>
                    <td className="p-2 text-right text-white">{pos.outcome}</td>
                    <td className="p-2 text-right text-white font-mono">{pos.shares.toFixed(4)}</td>
                    <td className="p-2 text-right text-white font-mono">{formatUSD(pos.avgPrice)}</td>
                    <td className="p-2 text-right text-white font-mono">{formatUSD(pos.cost)}</td>
                    <td className="p-2 text-right text-white font-mono">{formatUSD(pos.currentPrice)}</td>
                    <td className="p-2 text-right text-white font-mono">{formatUSD(pos.currentValue)}</td>
                    <td className={`p-2 text-right font-mono ${pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pos.pnl >= 0 ? '+' : ''}{formatUSD(pos.pnl)}
                    </td>
                    <td className="p-2 text-right">
                      {pos.isCostCorrect ? (
                        <span className="text-green-400 text-xs">✓</span>
                      ) : (
                        <span className="text-red-400 text-xs" title={`差异: ${formatUSD(pos.costVsInvestedDifference)}`}>
                          ✗
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 交易记录 */}
      {transactions.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">交易记录 ({transactions.length})</h2>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-800">
                <tr className="border-b border-gray-700">
                  <th className="text-left p-2 text-gray-400">时间</th>
                  <th className="text-right p-2 text-gray-400">金额</th>
                  <th className="text-left p-2 text-gray-400">类型</th>
                  <th className="text-left p-2 text-gray-400">原因</th>
                  <th className="text-left p-2 text-gray-400">状态</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-gray-700/50">
                    <td className="p-2 text-gray-300 text-xs">{formatDate(tx.createdAt)}</td>
                    <td className={`p-2 text-right font-mono ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.amount >= 0 ? '+' : ''}{formatUSD(tx.amount)}
                    </td>
                    <td className="p-2 text-gray-300">{tx.type}</td>
                    <td className="p-2 text-gray-400 text-xs">{tx.reason || '-'}</td>
                    <td className="p-2 text-gray-300">{tx.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 订单记录 */}
      {orders.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">订单记录 ({orders.length})</h2>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-800">
                <tr className="border-b border-gray-700">
                  <th className="text-left p-2 text-gray-400">时间</th>
                  <th className="text-right p-2 text-gray-400">金额</th>
                  <th className="text-right p-2 text-gray-400">手续费</th>
                  <th className="text-right p-2 text-gray-400">净额</th>
                  <th className="text-left p-2 text-gray-400">方向</th>
                  <th className="text-left p-2 text-gray-400">类型</th>
                  <th className="text-left p-2 text-gray-400">状态</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-700/50">
                    <td className="p-2 text-gray-300 text-xs">{formatDate(order.createdAt)}</td>
                    <td className="p-2 text-right text-white font-mono">{formatUSD(order.amount)}</td>
                    <td className="p-2 text-right text-gray-400 font-mono">{formatUSD(order.feeDeducted)}</td>
                    <td className="p-2 text-right text-white font-mono">{formatUSD(order.netAmount)}</td>
                    <td className="p-2 text-gray-300">{order.outcomeSelection}</td>
                    <td className="p-2 text-gray-300">{order.orderType}</td>
                    <td className="p-2 text-gray-300">{order.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

