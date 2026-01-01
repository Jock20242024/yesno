"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface FeeIncomeData {
  totalIncome: number;
  todayIncome: number;
  yesterdayIncome: number;
  todayGrowthPercent: number;
  totalGrowthPercent: number;
  trendData: Array<{ date: string; income: number }>;
  timeRange: string;
}

export default function AdminFeesPage() {
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month">("month");
  const [data, setData] = useState<FeeIncomeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/admin/fees/income?timeRange=${timeRange}`, {
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error('获取手续费收入数据失败');
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
          setData(result.data);
        } else {
          throw new Error(result.error || '获取手续费收入数据失败');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取手续费收入数据失败');
        console.error('获取手续费收入数据失败:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

  // 格式化金额
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // 格式化增长率
  const formatGrowthPercent = (percent: number) => {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  // 格式化趋势图日期标签
  const formatChartDate = (date: string, range: string) => {
    if (range === 'day') {
      // 按日：显示月-日 (MM-DD)
      const parts = date.split('-');
      return `${parts[1]}-${parts[2]}`;
    } else if (range === 'week') {
      // 按周：显示月-日 (MM-DD，周的开始日期)
      const parts = date.split('-');
      return `${parts[1]}-${parts[2]}`;
    } else {
      // 按月：显示年-月 (YYYY-MM)
      return date;
    }
  };

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
            {isLoading ? (
              <p className="text-[#637588] dark:text-[#9da8b9] text-3xl font-bold leading-tight">加载中...</p>
            ) : error ? (
              <p className="text-red-500 text-sm">加载失败</p>
            ) : (
              <p className="text-[#111418] dark:text-white text-3xl font-bold leading-tight">
                {formatCurrency(data?.totalIncome || 0)}
              </p>
            )}
          </div>
          {!isLoading && !error && data && (
            <>
              <p className={`${data.totalGrowthPercent >= 0 ? 'text-[#0bda5e]' : 'text-red-500'} text-sm font-medium leading-normal mt-1 flex items-center gap-1`}>
                <span className="material-symbols-outlined text-[16px]">
                  {data.totalGrowthPercent >= 0 ? 'trending_up' : 'trending_down'}
                </span>
                {formatGrowthPercent(data.totalGrowthPercent)} 较上期
              </p>
            </>
          )}
        </div>

        {/* 今日收入 */}
        <div className="flex flex-col gap-2 rounded-xl p-6 bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium leading-normal">今日收入</p>
            <span className="material-symbols-outlined text-primary">today</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            {isLoading ? (
              <p className="text-[#637588] dark:text-[#9da8b9] text-3xl font-bold leading-tight">加载中...</p>
            ) : error ? (
              <p className="text-red-500 text-sm">加载失败</p>
            ) : (
              <p className="text-[#111418] dark:text-white text-3xl font-bold leading-tight">
                {formatCurrency(data?.todayIncome || 0)}
              </p>
            )}
          </div>
          {!isLoading && !error && data && (
            <>
              <p className={`${data.todayGrowthPercent >= 0 ? 'text-[#0bda5e]' : 'text-red-500'} text-sm font-medium leading-normal mt-1 flex items-center gap-1`}>
                <span className="material-symbols-outlined text-[16px]">
                  {data.todayGrowthPercent >= 0 ? 'trending_up' : 'trending_down'}
                </span>
                {formatGrowthPercent(data.todayGrowthPercent)} 较昨日
              </p>
            </>
          )}
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
          <div className="w-full h-[500px] relative bg-[#f9fafb] dark:bg-[#101822] rounded-lg border border-[#e5e7eb] dark:border-[#283545]">
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-[#637588] dark:text-[#9da8b9]">加载中...</div>
              </div>
            ) : error ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-red-500 text-sm">加载失败: {error}</div>
              </div>
            ) : !data || !data.trendData || data.trendData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <span className="material-symbols-outlined text-[#637588] dark:text-[#9da8b9]" style={{ fontSize: 64 }}>
                    bar_chart
                  </span>
                  <div className="text-center">
                    <p className="text-[#637588] dark:text-[#9da8b9] font-medium">暂无数据</p>
                    <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">当前时间段内没有手续费收入记录</p>
                  </div>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.trendData.map(item => ({
                    date: formatChartDate(item.date, timeRange),
                    income: Number(item.income.toFixed(2)),
                    fullDate: item.date,
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-[#283545]" />
                  <XAxis
                    dataKey="date"
                    stroke="#637588"
                    className="dark:stroke-[#9da8b9] dark:tick:text-[#9da8b9]"
                    tick={{ fill: '#637588' }}
                  />
                  <YAxis
                    stroke="#637588"
                    className="dark:stroke-[#9da8b9] dark:tick:text-[#9da8b9]"
                    tick={{ fill: '#637588' }}
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      color: '#111418',
                    }}
                    labelStyle={{ color: '#637588', fontWeight: 'bold' }}
                    formatter={(value: any) => [formatCurrency(value), '手续费收入']}
                  />
                  <Bar
                    dataKey="income"
                    fill="#3b82f6"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

