"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { FileText, Download, X, Lightbulb } from "lucide-react";
import { toPng, toJpeg } from "html-to-image";

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
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportData, setReportData] = useState<StatsData | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

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

  // 生成周报
  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      // 调用API获取数据（使用当前stats或重新获取）
      const response = await fetch("/api/admin/finance/stats", {
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "获取报告数据失败");
      }

      setReportData(result.data);
      setIsReportOpen(true);
    } catch (error: any) {
      console.error("生成报告失败:", error);
      toast.error(error.message || "生成报告失败");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // 导出报告为图片
  const handleExportReport = async (format: 'png' | 'jpg' = 'png') => {
    if (!reportRef.current) {
      toast.error("报告内容未准备好");
      return;
    }

    try {
      const dataUrl = format === 'png' 
        ? await toPng(reportRef.current, { quality: 1.0, pixelRatio: 2 })
        : await toJpeg(reportRef.current, { quality: 1.0, pixelRatio: 2 });

      // 创建下载链接
      const link = document.createElement('a');
      link.download = `做市监控周报_${new Date().toISOString().split('T')[0]}.${format}`;
      link.href = dataUrl;
      link.click();

      toast.success(`报告已导出为${format.toUpperCase()}格式`);
    } catch (error: any) {
      console.error("导出报告失败:", error);
      toast.error("导出报告失败");
    }
  };

  // 生成运营建议
  const generateQuickTips = (): string => {
    if (!stats) return "数据加载中，暂无建议";

    const efficiency = stats.capitalEfficiency;
    const equity = stats.netEquity;

    if (efficiency < 0.1) {
      return "资金利用率较低，建议减少流动性注入或增加市场推广以提升交易量。";
    } else if (efficiency > 2.0) {
      return "资金利用率过高，可能存在滑点风险，建议补充流动性以改善用户体验。";
    }

    if (equity < 0) {
      return "净值走势为负，系统出现亏损，建议检查市场结算逻辑和流动性管理策略。";
    } else if (equity > stats.totalInjected * 0.1) {
      return "净值走势良好，系统运行健康，继续保持当前运营策略。";
    }

    return "系统运行正常，建议持续监控资金利用率和净值走势，适时调整流动性策略。";
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
        {/* 页面标题和操作按钮 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">做市监控看板</h1>
            <p className="text-gray-400">实时监控做市收益、资金利用率和净值走势</p>
          </div>
          <button
            onClick={handleGenerateReport}
            disabled={isGeneratingReport || isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <FileText size={18} />
            {isGeneratingReport ? "生成中..." : "生成周报"}
          </button>
        </div>

        {/* 运营助手卡片 */}
        {stats && (
          <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <Lightbulb className="text-yellow-400 mt-1 flex-shrink-0" size={24} />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2">运营助手</h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {generateQuickTips()}
                </p>
              </div>
            </div>
          </div>
        )}

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

      {/* 周报预览模态框 */}
      {isReportOpen && reportData && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0e13] rounded-xl border border-[#283545] max-w-4xl w-full max-h-[90vh] overflow-auto">
            {/* 模态框头部 */}
            <div className="sticky top-0 bg-[#0a0e13] border-b border-[#283545] p-4 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-white">做市监控周报</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportReport('png')}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Download size={16} />
                  导出PNG
                </button>
                <button
                  onClick={() => setIsReportOpen(false)}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* 报告内容 */}
            <div ref={reportRef} className="p-8 bg-white text-black">
              {/* 报告标题 */}
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2">做市监控周报</h1>
                <p className="text-gray-600">
                  {new Date().toLocaleDateString("zh-CN", { 
                    year: "numeric", 
                    month: "long", 
                    day: "numeric",
                    weekday: "long"
                  })}
                </p>
              </div>

              {/* 核心指标摘要 */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">📊 核心指标摘要</h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">今日点差收入</div>
                    <div className={`text-2xl font-bold ${reportData.todaySpreadProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(reportData.todaySpreadProfit)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {reportData.todaySpreadProfit >= 0 
                        ? "✅ 系统通过做市获得收益" 
                        : "⚠️ 系统出现亏损，需要关注"}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">累计回收本金</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(reportData.totalRecovered)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      已从市场结算中回收的初始流动性
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">坏账统计</div>
                    <div className={`text-2xl font-bold ${reportData.badDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(reportData.badDebt)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {reportData.badDebt > 0 
                        ? "⚠️ 存在无法回收的流动性损失" 
                        : "✅ 无坏账，资金管理良好"}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">AMM资金利用率</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {formatPercent(reportData.capitalEfficiency)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {reportData.capitalEfficiency < 0.1 
                        ? "💡 利用率较低，资金可能闲置" 
                        : reportData.capitalEfficiency > 2.0 
                        ? "⚠️ 利用率过高，可能存在滑点风险" 
                        : "✅ 利用率合理，资金使用效率良好"}
                    </div>
                  </div>
                </div>
              </div>

              {/* 资金状况 */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">💰 资金状况</h2>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">AMM账户余额</div>
                      <div className="text-xl font-bold">{formatCurrency(reportData.ammBalance)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">流动性账户余额</div>
                      <div className="text-xl font-bold">{formatCurrency(reportData.liquidityBalance)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">净值走势</div>
                      <div className={`text-xl font-bold ${reportData.netEquity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(reportData.netEquity)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-700">
                      <strong>净值走势说明：</strong>
                      {reportData.netEquity >= 0 
                        ? "系统资产稳步增长，做市策略运行良好。净值 = (AMM余额 + 流动性余额 + 未结算市场初始注入) - 累计总注入。"
                        : "系统资产出现负增长，需要检查市场结算逻辑和流动性管理策略。建议及时调整运营策略。"}
                    </p>
                  </div>
                </div>
              </div>

              {/* 近7天收益走势 */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">📈 近7天收益走势</h2>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={formatChartData(reportData.sevenDaysTrend)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          stroke="#6b7280"
                          fontSize={12}
                          tickLine={{ stroke: "#6b7280" }}
                        />
                        <YAxis
                          stroke="#6b7280"
                          fontSize={12}
                          tickLine={{ stroke: "#6b7280" }}
                          tickFormatter={(value) => formatCurrency(value)}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                          formatter={(value: any) => formatCurrency(value)}
                        />
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
                  <div className="mt-4 text-sm text-gray-600">
                    <p>
                      <strong>趋势分析：</strong>
                      {(() => {
                        const profits = reportData.sevenDaysTrend.map(d => d.profit);
                        const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
                        const trend = profits[profits.length - 1] - profits[0];
                        if (trend > 0) {
                          return `收益呈上升趋势，平均每日收益 ${formatCurrency(avgProfit)}，系统运行良好。`;
                        } else if (trend < 0) {
                          return `收益呈下降趋势，平均每日收益 ${formatCurrency(avgProfit)}，建议关注市场活跃度和流动性管理。`;
                        } else {
                          return `收益保持稳定，平均每日收益 ${formatCurrency(avgProfit)}，系统运行平稳。`;
                        }
                      })()}
                    </p>
                  </div>
                </div>
              </div>

              {/* 运营建议 */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">💡 运营建议</h2>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
                  <p className="text-gray-800 leading-relaxed">
                    {generateQuickTips()}
                  </p>
                </div>
              </div>

              {/* 审计信息 */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">✅ 审计信息</h2>
                <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-lg">
                  <p className="text-gray-800">
                    <strong>本次审计已通过系统原子性校准，差异额：</strong>
                    <span className="text-green-600 font-bold">
                      {reconcileResult 
                        ? formatCurrency(reconcileResult.summary.totalDifference)
                        : formatCurrency(0)}
                    </span>
                  </p>
                  {reconcileResult && reconcileResult.summary.hasAnomaly && (
                    <p className="text-red-600 text-sm mt-2">
                      ⚠️ 检测到账目异常，请核查流水记录。
                    </p>
                  )}
                </div>
              </div>

              {/* 报告底部 */}
              <div className="text-center text-sm text-gray-500 pt-4 border-t border-gray-200">
                <p>本报告由 YesNo 做市监控系统自动生成</p>
                <p>生成时间：{new Date().toLocaleString("zh-CN")}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

