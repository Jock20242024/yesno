"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface StatsData {
  todaySpreadProfit: number;
  totalRecovered: number;
  badDebt: number;
  totalInjected: number;
  ammBalance: number;
  liquidityBalance: number;
  unresolvedLiquidity: number;
  netEquity: number;
  capitalEfficiency: number;
  totalResolvedProfitLoss: number;
  sevenDaysTrend: Array<{ date: string; profit: number }>;
}

interface ReconcileResult {
  accounts: Array<{
    accountType: string;
    email: string;
    currentBalance: number;
    transactionSum: number;
    difference: number;
    isBalanced: boolean;
  }>;
  summary: {
    totalCurrentBalance: number;
    totalTransactionSum: number;
    totalDifference: number;
    isOverallBalanced: boolean;
    hasAnomaly: boolean;
  };
}

export default function MarketMakingStatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);

  // 获取统计数据
  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/admin/finance/stats", {
          credentials: "include",
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          const errorMessage = result.error || "获取统计数据失败";
          console.error("获取统计数据失败:", errorMessage);
          toast.error(errorMessage);
          // 如果是因为系统账户不存在，显示更友好的提示
          if (errorMessage.includes("系统账户不存在")) {
            toast.info("系统正在自动创建账户，请稍后刷新页面");
          }
          throw new Error(errorMessage);
        }

        setStats(result.data);
      } catch (error: any) {
        console.error("获取统计数据失败:", error);
        // 不重复显示toast，因为上面已经显示过了
        if (!error.message?.includes("获取统计数据失败")) {
          toast.error(error.message || "获取统计数据失败");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
    // 每30秒自动刷新
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // 一键对账
  const handleReconcile = async () => {
    setIsReconciling(true);
    try {
      const response = await fetch("/api/admin/system-accounts/reconcile", {
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "对账失败");
      }

      setReconcileResult(result.data);
    } catch (error: any) {
      console.error("对账失败:", error);
      toast.error(error.message || "对账失败");
    } finally {
      setIsReconciling(false);
    }
  };

  // 格式化金额
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // 格式化百分比
  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  // 格式化图表数据
  const formatChartData = (data: Array<{ date: string; profit: number }>) => {
    return data.map((d) => ({
      date: new Date(d.date).toLocaleDateString("zh-CN", { month: "short", day: "numeric" }),
      profit: d.profit,
      fullDate: d.date,
    }));
  };

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1f2937] border border-[#374151] rounded-lg p-3 shadow-lg">
          <p className="text-white text-sm font-medium mb-1">
            {payload[0].payload.fullDate
              ? new Date(payload[0].payload.fullDate).toLocaleDateString("zh-CN")
              : ""}
          </p>
          <p className="text-blue-400 text-sm">
            收益: <span className="font-bold">{formatCurrency(payload[0].value)}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0e13] p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-white text-center py-20">加载中...</div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-[#0a0e13] p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-red-500 text-center py-20">数据加载失败</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e13] p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">做市监控看板</h1>
          <p className="text-gray-400">实时监控做市收益、资金利用率和净值走势</p>
        </div>

        {/* 核心指标卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* 今日点差收入 */}
          <div className="bg-[#111418] border border-[#283545] rounded-xl p-6">
            <div className="text-gray-400 text-sm mb-2">今日点差收入</div>
            <div className={`text-2xl font-bold ${stats.todaySpreadProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(stats.todaySpreadProfit)}
            </div>
            <div className="text-xs text-gray-500 mt-2">MARKET_PROFIT_LOSS 24小时汇总</div>
          </div>

          {/* 累计回收本金 */}
          <div className="bg-[#111418] border border-[#283545] rounded-xl p-6">
            <div className="text-gray-400 text-sm mb-2">累计回收本金</div>
            <div className="text-2xl font-bold text-blue-400">
              {formatCurrency(stats.totalRecovered)}
            </div>
            <div className="text-xs text-gray-500 mt-2">LIQUIDITY_RECOVERY 汇总</div>
          </div>

          {/* 坏账统计 */}
          <div className="bg-[#111418] border border-[#283545] rounded-xl p-6">
            <div className="text-gray-400 text-sm mb-2">坏账统计</div>
            <div className={`text-2xl font-bold ${stats.badDebt > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {formatCurrency(stats.badDebt)}
            </div>
            <div className="text-xs text-gray-500 mt-2">MARKET_PROFIT_LOSS 负数汇总</div>
          </div>

          {/* AMM资金利用率 */}
          <div className="bg-[#111418] border border-[#283545] rounded-xl p-6">
            <div className="text-gray-400 text-sm mb-2">AMM资金利用率</div>
            <div className="text-2xl font-bold text-yellow-400">
              {formatPercent(stats.capitalEfficiency)}
            </div>
            <div className="text-xs text-gray-500 mt-2">当日成交额 / AMM余额</div>
          </div>
        </div>

        {/* 账户余额和净值 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* AMM账户余额 */}
          <div className="bg-[#111418] border border-[#283545] rounded-xl p-6">
            <div className="text-gray-400 text-sm mb-2">AMM账户余额</div>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(stats.ammBalance)}
            </div>
          </div>

          {/* 流动性账户余额 */}
          <div className="bg-[#111418] border border-[#283545] rounded-xl p-6">
            <div className="text-gray-400 text-sm mb-2">流动性账户余额</div>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(stats.liquidityBalance)}
            </div>
          </div>

          {/* 净值走势 */}
          <div className="bg-[#111418] border border-[#283545] rounded-xl p-6">
            <div className="text-gray-400 text-sm mb-2">净值走势</div>
            <div className={`text-2xl font-bold ${stats.netEquity >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(stats.netEquity)}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              (AMM + 流动性 + 未结算) - 总注入
            </div>
          </div>
        </div>

        {/* 近7天收益走势 */}
        <div className="bg-[#111418] border border-[#283545] rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">近7天收益走势</h2>
            <div className="text-sm text-gray-400">
              已结算市场累计盈亏:{" "}
              <span className={stats.totalResolvedProfitLoss >= 0 ? "text-green-400" : "text-red-400"}>
                {formatCurrency(stats.totalResolvedProfitLoss)}
              </span>
            </div>
          </div>
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={formatChartData(stats.sevenDaysTrend)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={{ stroke: "#9ca3af" }}
                />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={{ stroke: "#9ca3af" }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 对账状态 */}
        <div className="bg-[#111418] border border-[#283545] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">对账状态</h2>
            <button
              onClick={handleReconcile}
              disabled={isReconciling}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isReconciling ? "对账中..." : "一键对账"}
            </button>
          </div>

          {reconcileResult && (
            <div className="mt-4">
              {reconcileResult.summary.hasAnomaly ? (
                <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
                  <div className="text-red-400 font-bold mb-2">⚠️ 账目存在异常，请核查流水！</div>
                  <div className="text-sm text-gray-300 space-y-1">
                    <div>当前余额: {formatCurrency(reconcileResult.summary.totalCurrentBalance)}</div>
                    <div>流水总和: {formatCurrency(reconcileResult.summary.totalTransactionSum)}</div>
                    <div>差额: {formatCurrency(reconcileResult.summary.totalDifference)}</div>
                  </div>
                </div>
              ) : (
                <div className="bg-green-900/20 border border-green-500 rounded-lg p-4">
                  <div className="text-green-400 font-bold mb-2">✅ 账目平衡</div>
                  <div className="text-sm text-gray-300 space-y-1">
                    <div>当前余额: {formatCurrency(reconcileResult.summary.totalCurrentBalance)}</div>
                    <div>流水总和: {formatCurrency(reconcileResult.summary.totalTransactionSum)}</div>
                    <div>差额: {formatCurrency(reconcileResult.summary.totalDifference)}</div>
                  </div>
                </div>
              )}

              {/* 详细账户对账结果 */}
              <div className="mt-4 space-y-2">
                {reconcileResult.accounts.map((account) => (
                  <div
                    key={account.accountType}
                    className={`p-3 rounded-lg ${
                      account.isBalanced
                        ? "bg-green-900/10 border border-green-500/30"
                        : "bg-red-900/10 border border-red-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-white">{account.email}</div>
                      <div className={`text-sm ${account.isBalanced ? "text-green-400" : "text-red-400"}`}>
                        {account.isBalanced ? "✓ 平衡" : "✗ 异常"}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      余额: {formatCurrency(account.currentBalance)} | 流水: {formatCurrency(account.transactionSum)} | 差额: {formatCurrency(account.difference)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!reconcileResult && (
            <div className="text-gray-400 text-sm text-center py-4">
              点击"一键对账"按钮检查账目平衡状态
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

