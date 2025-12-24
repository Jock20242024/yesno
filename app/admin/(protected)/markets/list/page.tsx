"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminMarkets } from "@/hooks/useAdminData";
import MarketTable from "@/app/admin/markets/components/MarketTable";

export default function MarketsListPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showDetails, setShowDetails] = useState(false); // 🔥 下钻功能：是否显示详细场次
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set()); // 🔥 展开的系列
  const [showHistorical, setShowHistorical] = useState<Record<string, boolean>>({}); // 🔥 每个系列是否显示历史记录
  const limit = 10;

  // 将状态传递给 Hook（添加 showDetails 参数）
  // 🚀 第三步：强制传 source='manual'，只显示手动市场
  const { markets, isLoading, error, pagination } = useAdminMarkets({
    search: searchQuery,
    status: statusFilter,
    page: currentPage,
    limit: limit,
    showDetails: showDetails,
    source: 'manual', // 🚀 第三步：只显示手动市场
  });

  // 处理展开/收起
  const handleToggleExpand = (seriesKey: string) => {
    const newExpanded = new Set(expandedSeries);
    if (newExpanded.has(seriesKey)) {
      newExpanded.delete(seriesKey);
    } else {
      newExpanded.add(seriesKey);
    }
    setExpandedSeries(newExpanded);
  };

  // 处理历史记录显示
  const handleToggleHistorical = (seriesKey: string) => {
    setShowHistorical(prev => ({
      ...prev,
      [seriesKey]: !prev[seriesKey]
    }));
  };

  // 处理搜索输入变化（防抖）
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // 重置到第一页
  };

  // 处理状态筛选变化
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1); // 重置到第一页
  };

  // 处理分页
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 🔥 处理删除市场
  const handleDeleteMarket = async (marketId: string, marketTitle: string) => {
    // 二次确认
    const confirmed = window.confirm(`确定要删除市场 "${marketTitle}" 吗？\n\n此操作将隐藏该市场，用户将无法再看到它。`);
    
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/markets/${marketId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        alert('市场已成功删除');
        // 刷新列表（通过重新获取数据）
        window.location.reload();
      } else {
        alert(`删除失败: ${result.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('删除市场失败:', error);
      alert('删除失败，请稍后重试');
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] flex flex-col gap-6">
      {/* 页面标题和操作按钮 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111418] dark:text-white">市场管理</h1>
          <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">查看、编辑和结算所有预测市场</p>
        </div>
        <Link
          href="/admin/markets/create"
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm text-sm font-medium whitespace-nowrap"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add_business</span>
          创建市场
        </Link>
      </div>

      {/* 搜索和筛选区域 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-card-light dark:bg-card-dark p-4 rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          {/* 🔥 下钻功能切换按钮 */}
          <button
            onClick={() => {
              setShowDetails(!showDetails);
              setCurrentPage(1); // 重置到第一页
            }}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              showDetails
                ? "bg-primary text-white hover:bg-primary/90"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {showDetails ? "显示聚合视图" : "显示详细场次"}
          </button>
          {/* 搜索框 */}
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-[#637588] dark:text-[#9da8b9]" style={{ fontSize: 20 }}>search</span>
            </div>
            <input
              className="block w-full pl-10 pr-3 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg leading-5 bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
              placeholder="搜索市场ID / 标题..."
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>

          {/* 状态筛选 */}
          <div className="relative w-full sm:w-48">
            <select
              className="block w-full pl-3 pr-10 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg leading-5 bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm appearance-none"
              value={statusFilter}
              onChange={handleStatusChange}
            >
              <option value="">所有状态</option>
              <option value="open">进行中</option>
              <option value="closed">已关闭</option>
              <option value="pending">待结算</option>
              <option value="resolved">已结算</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-[#637588] dark:text-[#9da8b9]" style={{ fontSize: 20 }}>expand_more</span>
            </div>
          </div>
        </div>
      </div>

      {/* 🚀 使用 MarketTable 组件（mode='manual'） */}
      <MarketTable
        markets={markets}
        isLoading={isLoading}
        error={error}
        pagination={pagination}
        mode="manual"
        showDetails={showDetails}
        expandedSeries={expandedSeries}
        showHistorical={showHistorical}
        onToggleExpand={handleToggleExpand}
        onToggleHistorical={handleToggleHistorical}
        onPageChange={handlePageChange}
        onDeleteMarket={handleDeleteMarket}
      />
    </div>
  );
}
