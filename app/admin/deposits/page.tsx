"use client";

import { useState, useMemo } from "react";
import { useDeposits } from "@/hooks/useAdminData";

export default function AdminDepositsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  // 构建查询参数
  const queryParams = useMemo(
    () => ({
      search: searchQuery || undefined,
      status: statusFilter || undefined,
      page,
      limit,
    }),
    [searchQuery, statusFilter, page]
  );

  // 获取充值数据
  const { deposits, isLoading, error, pagination } = useDeposits(queryParams);

  // 格式化时间
  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }),
      time: date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    };
  };

  // 获取状态徽章样式
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
      completed: {
        bg: "bg-green-100",
        text: "text-green-800",
        darkBg: "dark:bg-green-900/30",
        darkText: "dark:text-green-400",
      },
      pending: {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        darkBg: "dark:bg-yellow-900/30",
        darkText: "dark:text-yellow-400",
      },
      failed: {
        bg: "bg-red-100",
        text: "text-red-800",
        darkBg: "dark:bg-red-900/30",
        darkText: "dark:text-red-400",
      },
      cancelled: {
        bg: "bg-gray-100",
        text: "text-gray-800",
        darkBg: "dark:bg-gray-900/30",
        darkText: "dark:text-gray-400",
      },
    };

    const style = statusMap[status] || statusMap.pending;
    return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text} ${style.darkBg} ${style.darkText}`;
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      completed: "已完成",
      pending: "待处理",
      failed: "失败",
      cancelled: "已取消",
    };
    return statusMap[status] || status;
  };

  // 获取用户头像首字母
  const getUserInitials = (username: string) => {
    return username
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="mx-auto max-w-[1400px] flex flex-col gap-6">
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
              placeholder="搜索订单号 / 用户名..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* 状态筛选 */}
          <div className="relative w-full sm:w-48">
            <select
              className="block w-full pl-3 pr-10 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg leading-5 bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm appearance-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">所有状态</option>
              <option value="pending">待处理</option>
              <option value="completed">已完成</option>
              <option value="failed">失败</option>
              <option value="cancelled">已取消</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-[#637588] dark:text-[#9da8b9]" style={{ fontSize: 20 }}>expand_more</span>
            </div>
          </div>

          {/* 时间筛选 */}
          <div className="relative w-full sm:w-48">
            <select
              className="block w-full pl-3 pr-10 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg leading-5 bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm appearance-none"
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
            >
              <option value="">全部时间</option>
              <option value="today">今天</option>
              <option value="week">最近7天</option>
              <option value="month">最近30天</option>
              <option value="custom">自定义范围</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-[#637588] dark:text-[#9da8b9]" style={{ fontSize: 20 }}>calendar_month</span>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3 w-full lg:w-auto">
          <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-[#101822] border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg text-[#111418] dark:text-white hover:bg-[#f3f4f6] dark:hover:bg-[#283545] transition-colors text-sm font-medium w-full lg:w-auto">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>filter_list</span>
            高级筛选
          </button>
          <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm text-sm font-medium w-full lg:w-auto whitespace-nowrap">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>download</span>
            导出数据
          </button>
        </div>
      </div>

      {/* 充值订单列表表格 */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e5e7eb] dark:border-[#283545] bg-[#f9fafb] dark:bg-[#101822]">
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">订单ID</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider min-w-[200px]">用户</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-right">金额</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">时间</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-center">状态</th>
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
                      <p className="text-[#637588] dark:text-[#9da8b9]">加载中...</p>
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
              {!isLoading && !error && deposits.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined text-[#637588] dark:text-[#9da8b9] opacity-50" style={{ fontSize: 48 }}>
                        payments
                      </span>
                      <div className="text-[#637588] dark:text-[#9da8b9]">
                        <p className="font-medium">暂无充值订单数据</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {/* 数据行 */}
              {!isLoading &&
                !error &&
                deposits.map((deposit) => {
                  const { date, time } = formatDateTime(deposit.timestamp);
                  const initials = getUserInitials(deposit.username);
                  return (
                    <tr key={deposit.orderId} className="hover:bg-[#f9fafb] dark:hover:bg-[#1e2a36] transition-colors group">
                      <td className="p-4">
                        <span className="text-sm font-medium text-[#111418] dark:text-white font-mono">#{deposit.orderId}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                            {initials}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-[#111418] dark:text-white">{deposit.username}</span>
                            <span className="text-xs text-[#637588] dark:text-[#9da8b9]">{deposit.userId}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-sm font-bold text-[#111418] dark:text-white">${deposit.amount.toFixed(2)}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-[#111418] dark:text-white">{date}</span>
                          <span className="text-xs text-[#637588] dark:text-[#9da8b9]">{time}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={getStatusBadge(deposit.status)}>{getStatusText(deposit.status)}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-1.5 rounded-md text-[#637588] dark:text-[#9da8b9] hover:bg-gray-100 dark:hover:bg-[#283545] hover:text-primary transition-colors" title="查看详情">
                            <span className="material-symbols-outlined text-[20px]">visibility</span>
                          </button>
                          <button className="p-1.5 rounded-md text-[#637588] dark:text-[#9da8b9] hover:bg-gray-100 dark:hover:bg-[#283545] hover:text-primary transition-colors" title="导出凭证">
                            <span className="material-symbols-outlined text-[20px]">receipt</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {!isLoading && !error && (
          <div className="flex items-center justify-between p-4 border-t border-[#e5e7eb] dark:border-[#283545] bg-card-light dark:bg-card-dark">
            <div className="text-sm text-[#637588] dark:text-[#9da8b9]">
              显示 <span className="font-medium text-[#111418] dark:text-white">{pagination.page === 1 ? 1 : (pagination.page - 1) * pagination.limit + 1}</span> 到{" "}
              <span className="font-medium text-[#111418] dark:text-white">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> 条，共{" "}
              <span className="font-medium text-[#111418] dark:text-white">{pagination.total}</span> 条结果
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page === 1}
                className="px-3 py-1 rounded border border-[#e5e7eb] dark:border-[#283545] text-sm font-medium text-[#637588] dark:text-[#9da8b9] bg-white dark:bg-[#101822] hover:bg-[#f3f4f6] dark:hover:bg-[#283545] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1 rounded border text-sm font-medium ${
                      pagination.page === pageNum
                        ? "border-primary bg-primary text-white"
                        : "border-[#e5e7eb] dark:border-[#283545] text-[#637588] dark:text-[#9da8b9] bg-white dark:bg-[#101822] hover:bg-[#f3f4f6] dark:hover:bg-[#283545]"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 rounded border border-[#e5e7eb] dark:border-[#283545] text-sm font-medium text-[#637588] dark:text-[#9da8b9] bg-white dark:bg-[#101822] hover:bg-[#f3f4f6] dark:hover:bg-[#283545] disabled:opacity-50 disabled:cursor-not-allowed"
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
