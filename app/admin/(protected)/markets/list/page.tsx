"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useAdminMarkets } from "@/hooks/useAdminData";

export default function MarketsListPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;

  // 将状态传递给 Hook
  const { markets, isLoading, error, pagination } = useAdminMarkets({
    search: searchQuery,
    status: statusFilter,
    page: currentPage,
    limit: limit,
  });

  // 格式化时间
  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 格式化金额
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // 获取状态显示文本和样式
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "OPEN":
        return { text: "进行中", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" };
      case "RESOLVED":
        return { text: "已结算", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" };
      case "CLOSED":
        return { text: "已关闭", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" };
      case "PENDING":
        return { text: "待结算", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" };
      default:
        return { text: status, className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" };
    }
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

      {/* 市场列表表格 */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e5e7eb] dark:border-[#283545] bg-[#f9fafb] dark:bg-[#101822]">
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">市场ID</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider min-w-[300px]">标题</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-center">状态</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-right">总交易量</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">结束时间</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb] dark:divide-[#283545]">
              {/* 加载状态 */}
              {isLoading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <p className="text-[#637588] dark:text-[#9da8b9]">加载市场数据...</p>
                    </div>
                  </td>
                </tr>
              )}

              {/* 错误状态 */}
              {error && !isLoading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined text-red-500" style={{ fontSize: 48 }}>
                        error
                      </span>
                      <p className="text-red-500">{error}</p>
                    </div>
                  </td>
                </tr>
              )}

              {/* 空状态 */}
              {!isLoading && !error && markets.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined text-[#637588] dark:text-[#9da8b9] opacity-50" style={{ fontSize: 48 }}>
                        storefront
                      </span>
                      <div className="text-[#637588] dark:text-[#9da8b9]">
                        <p className="font-medium">暂无市场数据</p>
                        <p className="text-xs mt-1">请尝试调整搜索条件或筛选条件</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {/* 市场数据行 */}
              {!isLoading && !error && markets.map((market) => {
                const statusDisplay = getStatusDisplay(market.status);
                return (
                  <tr key={market.id} className="hover:bg-[#f9fafb] dark:hover:bg-[#1e2a36] transition-colors group">
                    <td className="p-4">
                      <span className="text-sm font-medium text-[#111418] dark:text-white font-mono">{market.id}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-medium text-[#111418] dark:text-white">{market.title}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusDisplay.className}`}>
                        {statusDisplay.text}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-sm font-bold text-[#111418] dark:text-white">{formatCurrency(market.volume)}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-[#111418] dark:text-white">{formatDateTime(market.endTime).split(" ")[0]}</span>
                        <span className="text-xs text-[#637588] dark:text-[#9da8b9]">{formatDateTime(market.endTime).split(" ")[1]}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={'/admin/markets/edit/' + market.id}
                          className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                          title="编辑"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                          编辑
                        </Link>
                        {market.status !== "RESOLVED" && (
                          <Link
                            href={'/admin/markets/edit/' + market.id}
                            className="px-3 py-1.5 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-800 dark:text-green-400 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                            title="结算"
                          >
                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                            结算
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {!isLoading && !error && pagination.total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-[#e5e7eb] dark:border-[#283545] bg-card-light dark:bg-card-dark">
            <div className="text-sm text-[#637588] dark:text-[#9da8b9]">
              显示 <span className="font-medium text-[#111418] dark:text-white">{pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}</span> 到{" "}
              <span className="font-medium text-[#111418] dark:text-white">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{" "}
              条，共 <span className="font-medium text-[#111418] dark:text-white">{pagination.total}</span> 条结果
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1 rounded border border-[#e5e7eb] dark:border-[#283545] text-sm font-medium text-[#637588] dark:text-[#9da8b9] bg-white dark:bg-[#101822] hover:bg-[#f3f4f6] dark:hover:bg-[#283545] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                上一页
              </button>
              {/* 页码按钮 */}
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum: number;
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (pagination.page <= 3) {
                  pageNum = i + 1;
                } else if (pagination.page >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  pageNum = pagination.page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-1 rounded border text-sm font-medium transition-colors ${
                      pageNum === pagination.page
                        ? "border-primary bg-primary text-white"
                        : "border-[#e5e7eb] dark:border-[#283545] text-[#637588] dark:text-[#9da8b9] bg-white dark:bg-[#101822] hover:bg-[#f3f4f6] dark:hover:bg-[#283545]"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 rounded border border-[#e5e7eb] dark:border-[#283545] text-sm font-medium text-[#637588] dark:text-[#9da8b9] bg-white dark:bg-[#101822] hover:bg-[#f3f4f6] dark:hover:bg-[#283545] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
