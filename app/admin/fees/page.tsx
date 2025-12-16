"use client";

import { useState } from "react";

export default function AdminFeesPage() {
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month">("month");

  return (
    <div className="mx-auto max-w-[1400px] flex flex-col gap-6">
      {/* 页面标题和时间筛选 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111418] dark:text-white">手续费收入报表</h1>
          <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">查看平台手续费收入的详细统计和分析</p>
        </div>
        <div className="flex items-center p-1 bg-[#f3f4f6] dark:bg-[#101822] rounded-lg">
          <button
            onClick={() => setTimeRange("day")}
            className={`px-3 py-1 text-sm font-medium rounded shadow-sm transition-colors ${
              timeRange === "day"
                ? "text-white bg-primary"
                : "text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
            }`}
          >
            日
          </button>
          <button
            onClick={() => setTimeRange("week")}
            className={`px-3 py-1 text-sm font-medium rounded shadow-sm transition-colors ${
              timeRange === "week"
                ? "text-white bg-primary"
                : "text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
            }`}
          >
            周
          </button>
          <button
            onClick={() => setTimeRange("month")}
            className={`px-3 py-1 text-sm font-medium rounded shadow-sm transition-colors ${
              timeRange === "month"
                ? "text-white bg-primary"
                : "text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
            }`}
          >
            月
          </button>
        </div>
      </div>

      {/* 核心数据卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 累计总收入 */}
        <div className="flex flex-col gap-2 rounded-xl p-6 bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium leading-normal">累计总收入</p>
            <span className="material-symbols-outlined text-primary">attach_money</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-[#111418] dark:text-white text-3xl font-bold leading-tight">$0.00</p>
          </div>
          <p className="text-[#0bda5e] text-sm font-medium leading-normal mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">trending_up</span>
            +0.0% 较上期
          </p>
          <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">（占位符）</p>
        </div>

        {/* 今日收入 */}
        <div className="flex flex-col gap-2 rounded-xl p-6 bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium leading-normal">今日收入</p>
            <span className="material-symbols-outlined text-primary">today</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-[#111418] dark:text-white text-3xl font-bold leading-tight">$0.00</p>
          </div>
          <p className="text-[#0bda5e] text-sm font-medium leading-normal mt-1 flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">trending_up</span>
            +0.0% 较昨日
          </p>
          <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">（占位符）</p>
        </div>
      </div>

      {/* 手续费收入趋势图 */}
      <div className="rounded-xl bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm flex flex-col">
        <div className="p-6 border-b border-[#e5e7eb] dark:border-[#283545] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-[#111418] dark:text-white text-lg font-bold leading-tight">手续费收入趋势图</h3>
            <p className="text-[#637588] dark:text-[#9da8b9] text-sm mt-1">平台手续费收入的可视化分析（可按日/周/月切换）</p>
          </div>
        </div>
        <div className="p-6">
          <div className="w-full h-[500px] relative flex items-center justify-center bg-[#f9fafb] dark:bg-[#101822] rounded-lg border border-[#e5e7eb] dark:border-[#283545]">
            <div className="flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-[#637588] dark:text-[#9da8b9]" style={{ fontSize: 64 }}>
                bar_chart
              </span>
              <div className="text-center">
                <p className="text-[#637588] dark:text-[#9da8b9] font-medium">图表占位符</p>
                <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">手续费收入趋势图将在此显示</p>
                <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">（可按日/周/月切换）</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

