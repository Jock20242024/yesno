"use client";

import { useState, useMemo } from "react";
import { useFinanceSummary } from "@/hooks/useAdminData";

export default function DepositsWithdrawalsOverviewPage() {
  const [timeRange, setTimeRange] = useState<"today" | "week" | "month" | "year">("month");

  // 根据时间范围计算日期范围
  const dateRange = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (timeRange) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }, [timeRange]);

  // 获取财务汇总数据
  const { summary, isLoading, error } = useFinanceSummary({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  // 格式化金额
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="mx-auto max-w-[1400px] flex flex-col gap-6">
      {/* 页面标题和时间筛选 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111418] dark:text-white">充值提现总览</h1>
          <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">查看平台充值提现的整体数据统计</p>
        </div>
        <div className="flex items-center p-1 bg-[#f3f4f6] dark:bg-[#101822] rounded-lg">
          <button
            onClick={() => setTimeRange("today")}
            className={`px-3 py-1 text-sm font-medium rounded shadow-sm transition-colors ${
              timeRange === "today"
                ? "text-white bg-primary"
                : "text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
            }`}
          >
            今日
          </button>
          <button
            onClick={() => setTimeRange("week")}
            className={`px-3 py-1 text-sm font-medium rounded shadow-sm transition-colors ${
              timeRange === "week"
                ? "text-white bg-primary"
                : "text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
            }`}
          >
            本周
          </button>
          <button
            onClick={() => setTimeRange("month")}
            className={`px-3 py-1 text-sm font-medium rounded shadow-sm transition-colors ${
              timeRange === "month"
                ? "text-white bg-primary"
                : "text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
            }`}
          >
            本月
          </button>
          <button
            onClick={() => setTimeRange("year")}
            className={`px-3 py-1 text-sm font-medium rounded shadow-sm transition-colors ${
              timeRange === "year"
                ? "text-white bg-primary"
                : "text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
            }`}
          >
            本年
          </button>
        </div>
      </div>

      {/* 核心数据卡片 */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl p-6 bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm">
              <div className="flex justify-between items-start">
                <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium leading-normal">加载中...</p>
              </div>
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl p-6 bg-card-light dark:bg-card-dark border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-red-500">error</span>
            <p className="text-red-500">{error}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 总充值金额 */}
          <div className="flex flex-col gap-2 rounded-xl p-6 bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm">
            <div className="flex justify-between items-start">
              <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium leading-normal">总充值金额</p>
              <span className="material-symbols-outlined text-primary">payments</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-[#111418] dark:text-white text-2xl font-bold leading-tight">
                {summary ? formatCurrency(summary.totalDeposits) : "$0.00"}
              </p>
            </div>
            <p className="text-[#0bda5e] text-sm font-medium leading-normal mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">trending_up</span>
              +0.0% 较上期
            </p>
          </div>

          {/* 总提现金额 */}
          <div className="flex flex-col gap-2 rounded-xl p-6 bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm">
            <div className="flex justify-between items-start">
              <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium leading-normal">总提现金额</p>
              <span className="material-symbols-outlined text-[#fa6238]">move_to_inbox</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-[#111418] dark:text-white text-2xl font-bold leading-tight">
                {summary ? formatCurrency(summary.totalWithdrawals) : "$0.00"}
              </p>
            </div>
            <p className="text-[#fa6238] text-sm font-medium leading-normal mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">trending_down</span>
              +0.0% 较上期
            </p>
          </div>

          {/* 净流入金额 */}
          <div className="flex flex-col gap-2 rounded-xl p-6 bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm">
            <div className="flex justify-between items-start">
              <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium leading-normal">净流入金额</p>
              <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <p className={`text-[#111418] dark:text-white text-2xl font-bold leading-tight ${summary && summary.netFlow < 0 ? "text-[#fa6238]" : ""}`}>
                {summary ? formatCurrency(summary.netFlow) : "$0.00"}
              </p>
            </div>
            <p className={`text-sm font-medium leading-normal mt-1 flex items-center gap-1 ${summary && summary.netFlow < 0 ? "text-[#fa6238]" : "text-[#0bda5e]"}`}>
              <span className="material-symbols-outlined text-[16px]">{summary && summary.netFlow < 0 ? "trending_down" : "trending_up"}</span>
              {summary && summary.netFlow < 0 ? "净流出" : "净流入"}
            </p>
          </div>
        </div>
      )}

      {/* 充值 vs 提现趋势图 */}
      <div className="rounded-xl bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm flex flex-col">
        <div className="p-6 border-b border-[#e5e7eb] dark:border-[#283545] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-[#111418] dark:text-white text-lg font-bold leading-tight">充值 vs 提现趋势图</h3>
            <p className="text-[#637588] dark:text-[#9da8b9] text-sm mt-1">平台资金流动趋势可视化分析</p>
          </div>
        </div>
        <div className="p-6">
          <div className="w-full h-[400px] relative flex items-center justify-center bg-[#f9fafb] dark:bg-[#101822] rounded-lg border border-[#e5e7eb] dark:border-[#283545]">
            <div className="flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-[#637588] dark:text-[#9da8b9]" style={{ fontSize: 48 }}>
                bar_chart
              </span>
              <div className="text-center">
                <p className="text-[#637588] dark:text-[#9da8b9] font-medium">图表占位符</p>
                <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">充值 vs 提现趋势图将在此显示</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 详细数据表格（可选） */}
      <div className="rounded-xl bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm flex flex-col">
        <div className="p-6 border-b border-[#e5e7eb] dark:border-[#283545]">
          <h3 className="text-[#111418] dark:text-white text-lg font-bold leading-tight">详细数据</h3>
          <p className="text-[#637588] dark:text-[#9da8b9] text-sm mt-1">充值提现的详细数据列表</p>
        </div>
        <div className="p-6">
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-[#637588] dark:text-[#9da8b9] opacity-50" style={{ fontSize: 48 }}>
              table_chart
            </span>
            <p className="text-[#637588] dark:text-[#9da8b9] mt-4">详细数据表格占位符</p>
            <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">（占位符）</p>
          </div>
        </div>
      </div>
    </div>
  );
}

