"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useAdminUsers } from "@/hooks/useAdminData";
import { useNotification } from "@/components/providers/NotificationProvider";
import { useRouter } from "next/navigation";

// 注意：Admin Token 存储在 HttpOnly Cookie 中，浏览器会自动发送
// 不需要在 Authorization header 中手动传递

interface BalanceModalData {
  userId: string;
  email: string;
  currentBalance: number;
}

export default function AdminUserManagement() {
  const router = useRouter();
  const { addNotification } = useNotification();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;

  // 资金管理弹窗状态
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [balanceModalData, setBalanceModalData] = useState<BalanceModalData | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [isSubmittingBalance, setIsSubmittingBalance] = useState(false);

  // 防抖搜索：延迟 300ms 更新搜索查询
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1); // 搜索时重置到第一页
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 构建查询参数（使用防抖后的搜索查询）
  const queryParams = useMemo(
    () => ({
      search: debouncedSearchQuery || undefined,
      status: statusFilter || undefined,
      page: currentPage,
      limit,
    }),
    [debouncedSearchQuery, statusFilter, currentPage]
  );

  // 获取用户数据
  const { users, isLoading, error, pagination, refetch } = useAdminUsers(queryParams);

  // 禁用用户
  const handleBanUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/ban`, {
        method: "POST",
        headers: {
          // Cookie 会被浏览器自动发送（HttpOnly Cookie）
          "Content-Type": "application/json",
        },
        credentials: 'include', // 确保发送 Cookie
        body: JSON.stringify({ action: "ban" }),
      });

      const data = await response.json();

      if (data.success) {
        addNotification({ type: "success", title: "操作成功", message: "用户已禁用" });
        refetch(); // 刷新用户列表
      } else {
        addNotification({ type: "error", title: "操作失败", message: data.error || "禁用用户失败" });
      }
    } catch (err) {
      addNotification({ type: "error", title: "操作失败", message: "禁用用户失败" });
      console.error("Ban user error:", err);
    }
  };

  // 解禁用户
  const handleUnbanUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/ban`, {
        method: "POST",
        headers: {
          // Cookie 会被浏览器自动发送（HttpOnly Cookie）
          "Content-Type": "application/json",
        },
        credentials: 'include', // 确保发送 Cookie
        body: JSON.stringify({ action: "unban" }),
      });

      const data = await response.json();

      if (data.success) {
        addNotification({ type: "success", title: "操作成功", message: "用户已解禁" });
        refetch(); // 刷新用户列表
      } else {
        addNotification({ type: "error", title: "操作失败", message: data.error || "解禁用户失败" });
      }
    } catch (err) {
      addNotification({ type: "error", title: "操作失败", message: "解禁用户失败" });
      console.error("Unban user error:", err);
    }
  };

  // 打开资金管理弹窗
  const handleOpenBalanceModal = (user: { id: string; email: string; balance: number }) => {
    setBalanceModalData({
      userId: user.id,
      email: user.email,
      currentBalance: user.balance,
    });
    setAdjustmentAmount("");
    setAdjustmentReason("");
    setBalanceModalOpen(true);
  };

  // 关闭资金管理弹窗
  const handleCloseBalanceModal = () => {
    setBalanceModalOpen(false);
    setBalanceModalData(null);
    setAdjustmentAmount("");
    setAdjustmentReason("");
  };

  // 提交余额调整
  const handleSubmitBalanceAdjustment = async () => {
    if (!balanceModalData) return;

    // 验证金额
    const amount = parseFloat(adjustmentAmount);
    if (isNaN(amount) || amount === 0) {
      addNotification({ type: "error", title: "输入错误", message: "请输入有效的调整金额（非零数字）" });
      return;
    }

    // 验证原因
    if (!adjustmentReason.trim()) {
      addNotification({ type: "error", title: "输入错误", message: "请输入调整原因" });
      return;
    }

    // 检查余额是否足够（如果是扣款）
    if (amount < 0 && balanceModalData.currentBalance + amount < 0) {
      addNotification({ type: "error", title: "余额不足", message: "用户余额不足以完成此次扣款" });
      return;
    }

    setIsSubmittingBalance(true);

    try {
      const response = await fetch("/api/admin/users/balance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: balanceModalData.userId,
          amount,
          reason: adjustmentReason.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        addNotification({
          type: "success",
          title: "操作成功",
          message: `余额调整成功，新余额: $${data.data.newBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        });
        handleCloseBalanceModal();
        refetch(); // 刷新用户列表
        
        // 强制刷新余额显示：使用 window.location.reload() 作为临时测试手段
        console.log('💰 [Admin] 余额调整成功，强制刷新页面以更新余额显示');
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        addNotification({ type: "error", title: "操作失败", message: data.error || "余额调整失败" });
      }
    } catch (err) {
      addNotification({ type: "error", title: "操作失败", message: "余额调整失败，请稍后重试" });
      console.error("Balance adjustment error:", err);
    } finally {
      setIsSubmittingBalance(false);
    }
  };

  // 处理搜索框回车事件
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1);
    }
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }),
      time: date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    };
  };

  // 获取用户头像首字母
  const getInitials = (email: string) => {
    return email.split('@')[0]
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
              placeholder="搜索用户ID / 用户名 / 邮箱... (支持回车搜索)"
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
              }}
              onKeyDown={handleSearchKeyDown}
            />
          </div>

          {/* 状态筛选 */}
          <div className="relative w-full sm:w-48">
            <select
              className="block w-full pl-3 pr-10 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg leading-5 bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm appearance-none"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1); // 重置到第一页
              }}
            >
              <option value="">所有状态</option>
              <option value="active">活跃</option>
              <option value="disabled">已禁用</option>
              <option value="pending">待审核</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-[#637588] dark:text-[#9da8b9]" style={{ fontSize: 20 }}>expand_more</span>
            </div>
          </div>

          {/* 注册时间筛选 */}
          <div className="relative w-full sm:w-48">
            <select
              className="block w-full pl-3 pr-10 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg leading-5 bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm appearance-none"
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
            >
              <option value="">注册时间</option>
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
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>person_add</span>
            添加用户
          </button>
        </div>
      </div>

      {/* 用户列表表格 */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e5e7eb] dark:border-[#283545] bg-[#f9fafb] dark:bg-[#101822]">
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider w-16">
                  <div className="flex items-center justify-center">
                    <input className="rounded border-gray-300 text-primary focus:ring-primary" type="checkbox" />
                  </div>
                </th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider min-w-[120px]">用户 ID</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider min-w-[200px]">用户信息</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">注册时间</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">账户余额</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-center">状态</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb] dark:divide-[#283545]">
              {/* 加载状态 */}
              {isLoading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
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
                  <td colSpan={7} className="py-12 text-center">
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
              {!isLoading && !error && users.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined text-[#637588] dark:text-[#9da8b9] opacity-50" style={{ fontSize: 48 }}>
                        group
                      </span>
                      <div className="text-[#637588] dark:text-[#9da8b9]">
                        <p className="font-medium">暂无用户数据</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {/* 数据行 */}
              {!isLoading &&
                !error &&
                users.map((user) => {
                  const { date, time } = formatDate(user.createdAt);
                  const initials = getInitials(user.email);
                  const isBanned = user.isBanned;

                  return (
                    <tr key={user.id} className="hover:bg-[#f9fafb] dark:hover:bg-[#1e2a36] transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center justify-center">
                          <input className="rounded border-gray-300 text-primary focus:ring-primary" type="checkbox" />
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-medium text-[#111418] dark:text-white font-mono">#{user.id}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                            {initials}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-[#111418] dark:text-white">{user.email}</span>
                            <span className="text-xs text-[#637588] dark:text-[#9da8b9]">{user.isAdmin ? "管理员" : "普通用户"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-[#111418] dark:text-white">{date}</span>
                          <span className="text-xs text-[#637588] dark:text-[#9da8b9]">{time}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm font-bold text-[#111418] dark:text-white">
                          ${((user?.balance ?? 0) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {isBanned ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            已禁用
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            活跃
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenBalanceModal(user)}
                            className="p-1.5 rounded-md text-[#637588] dark:text-[#9da8b9] hover:bg-gray-100 dark:hover:bg-[#283545] hover:text-primary transition-colors"
                            title="资金管理"
                          >
                            <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                          </button>
                          {/* 🔥 查看详情按钮 - 跳转到用户详情页 */}
                          <button 
                            onClick={() => router.push(`/admin/users/${user.id}`)}
                            className="p-1.5 rounded-md text-[#637588] dark:text-[#9da8b9] hover:bg-gray-100 dark:hover:bg-[#283545] hover:text-primary transition-colors cursor-pointer" 
                            title="查看详情"
                          >
                            <span className="material-symbols-outlined text-[20px]">visibility</span>
                          </button>
                          {/* 🔥 编辑按钮 - 跳转到用户编辑页 */}
                          <button 
                            onClick={() => router.push(`/admin/users/${user.id}/edit`)}
                            className="p-1.5 rounded-md text-[#637588] dark:text-[#9da8b9] hover:bg-gray-100 dark:hover:bg-[#283545] hover:text-primary transition-colors cursor-pointer" 
                            title="编辑用户"
                          >
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </button>
                          {isBanned ? (
                            <button
                              onClick={() => handleUnbanUser(user.id)}
                              className="p-1.5 rounded-md text-[#637588] dark:text-[#9da8b9] hover:bg-gray-100 dark:hover:bg-[#283545] hover:text-green-500 transition-colors"
                              title="启用账户"
                            >
                              <span className="material-symbols-outlined text-[20px]">check_circle</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBanUser(user.id)}
                              className="p-1.5 rounded-md text-[#637588] dark:text-[#9da8b9] hover:bg-gray-100 dark:hover:bg-[#283545] hover:text-red-500 transition-colors"
                              title="禁用账户"
                            >
                              <span className="material-symbols-outlined text-[20px]">block</span>
                            </button>
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
          <div className="flex items-center justify-between p-4 border-t border-[#e5e7eb] dark:border-[#283545] bg-card-light dark:bg-card-dark">
            <div className="text-sm text-[#637588] dark:text-[#9da8b9]">
              显示 <span className="font-medium text-[#111418] dark:text-white">{pagination.page === 1 ? 1 : (pagination.page - 1) * pagination.limit + 1}</span> 到{" "}
              <span className="font-medium text-[#111418] dark:text-white">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> 条，共{" "}
              <span className="font-medium text-[#111418] dark:text-white">{pagination.total}</span> 条结果
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                    onClick={() => setCurrentPage(pageNum)}
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
                onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 rounded border border-[#e5e7eb] dark:border-[#283545] text-sm font-medium text-[#637588] dark:text-[#9da8b9] bg-white dark:bg-[#101822] hover:bg-[#f3f4f6] dark:hover:bg-[#283545] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 资金管理弹窗 */}
      {balanceModalOpen && balanceModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-xl w-full max-w-md mx-4 p-6">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#111418] dark:text-white">资金管理</h2>
              <button
                onClick={handleCloseBalanceModal}
                className="p-1.5 rounded-md text-[#637588] dark:text-[#9da8b9] hover:bg-gray-100 dark:hover:bg-[#283545] transition-colors"
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>

            {/* 用户信息 */}
            <div className="mb-6 p-4 bg-[#f9fafb] dark:bg-[#1e2a36] rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="size-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                  {balanceModalData.email.split('@')[0].slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-[#111418] dark:text-white">{balanceModalData.email}</p>
                  <p className="text-xs text-[#637588] dark:text-[#9da8b9]">用户 ID: {balanceModalData.userId.slice(0, 8)}...</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[#e5e7eb] dark:border-[#283545]">
                <p className="text-xs text-[#637588] dark:text-[#9da8b9] mb-1">当前余额</p>
                <p className="text-2xl font-bold text-[#111418] dark:text-white">
                  ${balanceModalData.currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* 调整金额输入 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
                调整金额 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#637588] dark:text-[#9da8b9]">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  placeholder="正数加钱，负数扣钱"
                  className="w-full pl-8 pr-3 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              {adjustmentAmount && !isNaN(parseFloat(adjustmentAmount)) && (
                <p className="mt-2 text-sm text-[#637588] dark:text-[#9da8b9]">
                  调整后余额: $
                  {(balanceModalData.currentBalance + parseFloat(adjustmentAmount)).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
            </div>

            {/* 调整原因输入 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
                调整原因 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="请输入调整原因（必填）"
                rows={3}
                className="w-full px-3 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <button
                onClick={handleCloseBalanceModal}
                disabled={isSubmittingBalance}
                className="flex-1 px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg text-[#111418] dark:text-white bg-white dark:bg-[#101822] hover:bg-[#f3f4f6] dark:hover:bg-[#283545] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                取消
              </button>
              <button
                onClick={handleSubmitBalanceAdjustment}
                disabled={isSubmittingBalance || !adjustmentAmount || !adjustmentReason.trim()}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmittingBalance ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>处理中...</span>
                  </>
                ) : (
                  "确认调整"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
