"use client";

import { useState, useMemo } from "react";
import { useWithdrawals } from "@/hooks/useAdminData";

const ADMIN_SECRET_TOKEN = "ADMIN_SECRET_TOKEN";

export default function AdminWithdrawalsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [processingId, setProcessingId] = useState<string | null>(null);
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

  // 获取提现数据
  const { withdrawals, isLoading, error, pagination } = useWithdrawals(queryParams);
  
  // 状态初始化：确保 pagination 对象始终存在且包含必需的属性
  const safePagination = pagination || {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  };

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
      approved: {
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
      rejected: {
        bg: "bg-red-100",
        text: "text-red-800",
        darkBg: "dark:bg-red-900/30",
        darkText: "dark:text-red-400",
      },
      completed: {
        bg: "bg-blue-100",
        text: "text-blue-800",
        darkBg: "dark:bg-blue-900/30",
        darkText: "dark:text-blue-400",
      },
    };

    const style = statusMap[status] || statusMap.pending;
    return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text} ${style.darkBg} ${style.darkText}`;
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      approved: "已通过",
      pending: "待审批",
      rejected: "已拒绝",
      completed: "已完成",
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

  const handleApprove = async (orderId: string) => {
    setProcessingId(orderId);
    try {
      // API 调用：调用新的 /api/admin/withdrawals/[order_id] API
      const response = await fetch(`/api/admin/withdrawals/${orderId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ADMIN_SECRET_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "approved" }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "审批失败");
      }

      const result = await response.json();
      if (result.success) {
        // UI 反馈：操作成功后刷新页面数据
        alert("提现请求已成功审批");
        window.location.reload();
      } else {
        throw new Error(result.error || "审批失败");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "审批失败");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (orderId: string) => {
    const reason = prompt("请输入拒绝原因：");
    if (!reason) return;

    setProcessingId(orderId);
    try {
      // API 调用：调用新的 /api/admin/withdrawals/[order_id] API
      const response = await fetch(`/api/admin/withdrawals/${orderId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ADMIN_SECRET_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "rejected", reason }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "拒绝失败");
      }

      const result = await response.json();
      if (result.success) {
        // UI 反馈：操作成功后刷新页面数据
        alert("提现请求已成功拒绝，金额已退还给用户");
        window.location.reload();
      } else {
        throw new Error(result.error || "拒绝失败");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "拒绝失败");
    } finally {
      setProcessingId(null);
    }
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
              <option value="pending">待审批</option>
              <option value="approved">已通过</option>
              <option value="rejected">已拒绝</option>
              <option value="completed">已完成</option>
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

      {/* 提现订单列表表格 */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e5e7eb] dark:border-[#283545] bg-[#f9fafb] dark:bg-[#101822]">
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">订单ID</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider min-w-[200px]">用户</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-right">金额</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider min-w-[250px]">目标地址</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">时间</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-center">状态</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb] dark:divide-[#283545]">
              {/* 空状态 */}
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <span className="material-symbols-outlined text-[#637588] dark:text-[#9da8b9] opacity-50" style={{ fontSize: 48 }}>
                      move_to_inbox
                    </span>
                    <div className="text-[#637588] dark:text-[#9da8b9]">
                      <p className="font-medium">暂无提现订单数据</p>
                      <p className="text-xs mt-1">（占位符）</p>
                    </div>
                  </div>
                </td>
              </tr>

              {/* 示例行（隐藏，展示表格结构） */}
              <tr className="hidden hover:bg-[#f9fafb] dark:hover:bg-[#1e2a36] transition-colors group">
                <td className="p-4">
                  <span className="text-sm font-medium text-[#111418] dark:text-white font-mono">#WD-123456</span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                      JD
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-[#111418] dark:text-white">John Doe</span>
                      <span className="text-xs text-[#637588] dark:text-[#9da8b9]">john.doe@example.com</span>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-right">
                  <span className="text-sm font-bold text-[#111418] dark:text-white">$1,000.00</span>
                </td>
                <td className="p-4">
                  <span className="text-sm text-[#111418] dark:text-white font-mono break-all">0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb</span>
                </td>
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="text-sm text-[#111418] dark:text-white">2024-01-15</span>
                    <span className="text-xs text-[#637588] dark:text-[#9da8b9]">14:30:00</span>
                  </div>
                </td>
                <td className="p-4 text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                    待审批
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleApprove("WD-123456")}
                      disabled={processingId === "WD-123456"}
                      className="px-3 py-1.5 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-800 dark:text-green-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      title="审批"
                    >
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      审批
                    </button>
                    <button
                      onClick={() => handleReject("WD-123456")}
                      disabled={processingId === "WD-123456"}
                      className="px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-800 dark:text-red-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      title="拒绝"
                    >
                      <span className="material-symbols-outlined text-[16px]">cancel</span>
                      拒绝
                    </button>
                  </div>
                </td>
              </tr>

              {/* 已通过状态示例行（隐藏） */}
              <tr className="hidden hover:bg-[#f9fafb] dark:hover:bg-[#1e2a36] transition-colors group">
                <td className="p-4">
                  <span className="text-sm font-medium text-[#111418] dark:text-white font-mono">#WD-123457</span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                      AS
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-[#111418] dark:text-white">Alice Smith</span>
                      <span className="text-xs text-[#637588] dark:text-[#9da8b9]">alice.smith@example.com</span>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-right">
                  <span className="text-sm font-bold text-[#111418] dark:text-white">$500.00</span>
                </td>
                <td className="p-4">
                  <span className="text-sm text-[#111418] dark:text-white font-mono break-all">0x8ba1f109551bD432803012645Hac136c22C9</span>
                </td>
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="text-sm text-[#111418] dark:text-white">2024-01-14</span>
                    <span className="text-xs text-[#637588] dark:text-[#9da8b9]">09:15:22</span>
                  </div>
                </td>
                <td className="p-4 text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    已通过
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-2">
                    <button className="p-1.5 rounded-md text-[#637588] dark:text-[#9da8b9] hover:bg-gray-100 dark:hover:bg-[#283545] hover:text-primary transition-colors" title="查看详情">
                      <span className="material-symbols-outlined text-[20px]">visibility</span>
                    </button>
                  </div>
                </td>
              </tr>

              {/* 已拒绝状态示例行（隐藏） */}
              <tr className="hidden hover:bg-[#f9fafb] dark:hover:bg-[#1e2a36] transition-colors group">
                <td className="p-4">
                  <span className="text-sm font-medium text-[#111418] dark:text-white font-mono">#WD-123458</span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                      RW
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-[#111418] dark:text-white">Robert Wang</span>
                      <span className="text-xs text-[#637588] dark:text-[#9da8b9]">robert.wang@test.com</span>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-right">
                  <span className="text-sm font-bold text-[#111418] dark:text-white">$2,000.00</span>
                </td>
                <td className="p-4">
                  <span className="text-sm text-[#111418] dark:text-white font-mono break-all">0x1234567890abcdef1234567890abcdef12345678</span>
                </td>
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="text-sm text-[#111418] dark:text-white">2024-01-12</span>
                    <span className="text-xs text-[#637588] dark:text-[#9da8b9]">18:45:10</span>
                  </div>
                </td>
                <td className="p-4 text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    已拒绝
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-2">
                    <button className="p-1.5 rounded-md text-[#637588] dark:text-[#9da8b9] hover:bg-gray-100 dark:hover:bg-[#283545] hover:text-primary transition-colors" title="查看详情">
                      <span className="material-symbols-outlined text-[20px]">visibility</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {!isLoading && !error && safePagination && (
          <div className="flex items-center justify-between p-4 border-t border-[#e5e7eb] dark:border-[#283545] bg-card-light dark:bg-card-dark">
            <div className="text-sm text-[#637588] dark:text-[#9da8b9]">
              显示 <span className="font-medium text-[#111418] dark:text-white">{safePagination.page === 1 ? 1 : (safePagination.page - 1) * safePagination.limit + 1}</span> 到{" "}
              <span className="font-medium text-[#111418] dark:text-white">{Math.min(safePagination.page * safePagination.limit, safePagination.total)}</span> 条，共{" "}
              <span className="font-medium text-[#111418] dark:text-white">{safePagination.total}</span> 条结果
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePagination.page === 1}
                className="px-3 py-1 rounded border border-[#e5e7eb] dark:border-[#283545] text-sm font-medium text-[#637588] dark:text-[#9da8b9] bg-white dark:bg-[#101822] hover:bg-[#f3f4f6] dark:hover:bg-[#283545] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              {Array.from({ length: Math.min(5, safePagination.totalPages || 1) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1 rounded border text-sm font-medium ${
                      safePagination.page === pageNum
                        ? "border-primary bg-primary text-white"
                        : "border-[#e5e7eb] dark:border-[#283545] text-[#637588] dark:text-[#9da8b9] bg-white dark:bg-[#101822] hover:bg-[#f3f4f6] dark:hover:bg-[#283545]"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(safePagination.totalPages || 1, p + 1))}
                disabled={safePagination.page >= (safePagination.totalPages || 1)}
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
