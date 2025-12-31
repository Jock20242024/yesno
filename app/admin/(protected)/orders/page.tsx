"use client";

import { useState, useEffect } from "react";

interface Order {
  id: string;
  userId: string;
  userEmail: string;
  marketId: string;
  marketTitle: string;
  marketStatus: string;
  outcomeSelection: string;
  amount: number;
  feeDeducted: number;
  payout: number | null;
  status: string;
  orderType: string;
  limitPrice: number | null;
  filledAmount: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdminOrdersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // 🔥 获取订单数据
  useEffect(() => {
    fetchOrders();
  }, [searchQuery, timeFilter, page]);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (timeFilter) params.append('status', timeFilter);
      params.append('page', page.toString());
      params.append('limit', '20');

      const response = await fetch(`/api/admin/orders?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('获取订单数据失败');
      }

      const result = await response.json();
      if (result.success) {
        setOrders(result.data || []);
        setTotal(result.pagination?.total || 0);
        setTotalPages(result.pagination?.totalPages || 0);
      } else {
        throw new Error(result.error || '获取订单数据失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取订单数据失败');
      console.error('获取订单数据失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="mx-auto max-w-[1400px] flex flex-col gap-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-[#111418] dark:text-white">用户下注订单列表</h1>
        <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">查看和管理所有用户的历史下注订单</p>
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
              placeholder="搜索订单ID / 用户 / 市场..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* 状态筛选 */}
          <div className="relative w-full sm:w-48">
            <select
              className="block w-full pl-3 pr-10 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg leading-5 bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm appearance-none"
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
            >
              <option value="">全部状态</option>
              <option value="PENDING">待成交</option>
              <option value="FILLED">已成交</option>
              <option value="CANCELLED">已取消</option>
              <option value="PARTIALLY_FILLED">部分成交</option>
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

      {/* 订单列表表格 */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e5e7eb] dark:border-[#283545] bg-[#f9fafb] dark:bg-[#101822]">
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">订单ID</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider min-w-[150px]">用户</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider min-w-[250px]">市场名称</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-center">下注选项</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-right">下注金额</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">下单时间</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-center">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb] dark:divide-[#283545]">
              {/* 加载状态 */}
              {isLoading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <p className="text-[#637588] dark:text-[#9da8b9]">加载订单数据...</p>
                    </div>
                  </td>
                </tr>
              )}

              {/* 错误状态 */}
              {error && !isLoading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <span className="material-symbol-outlined text-red-500" style={{ fontSize: 48 }}>
                        error
                      </span>
                      <p className="text-red-500">{error}</p>
                      <button
                        onClick={fetchOrders}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium mt-2"
                      >
                        重试
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* 空状态 */}
              {!isLoading && !error && orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined text-[#637588] dark:text-[#9da8b9] opacity-50" style={{ fontSize: 48 }}>
                        list_alt
                      </span>
                      <div className="text-[#637588] dark:text-[#9da8b9]">
                        <p className="font-medium">暂无订单数据</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {/* 订单数据 */}
              {!isLoading && !error && orders.map((order) => (
                <tr key={order.id} className="hover:bg-[#f9fafb] dark:hover:bg-[#1e2a36] transition-colors">
                  <td className="p-4">
                    <span className="text-sm font-medium text-[#111418] dark:text-white font-mono">
                      {order.id.substring(0, 16)}...
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                        {order.userEmail.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-[#111418] dark:text-white">{order.userEmail}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-[#111418] dark:text-white">{order.marketTitle}</span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      order.outcomeSelection === 'YES'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {order.outcomeSelection}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-sm font-bold text-[#111418] dark:text-white">
                      ${order.amount.toFixed(2)}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-[#111418] dark:text-white">
                        {formatDateTime(order.createdAt).split(' ')[0]}
                      </span>
                      <span className="text-xs text-[#637588] dark:text-[#9da8b9]">
                        {formatDateTime(order.createdAt).split(' ')[1]}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      order.status === 'FILLED'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : order.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : order.status === 'CANCELLED'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                    }`}>
                      {order.status === 'FILLED' ? '已成交' : order.status === 'PENDING' ? '待成交' : order.status === 'CANCELLED' ? '已取消' : order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="flex items-center justify-between p-4 border-t border-[#e5e7eb] dark:border-[#283545] bg-card-light dark:bg-card-dark">
          <div className="text-sm text-[#637588] dark:text-[#9da8b9]">
            显示 <span className="font-medium text-[#111418] dark:text-white">
              {orders.length > 0 ? (page - 1) * 20 + 1 : 0}
            </span> 到 <span className="font-medium text-[#111418] dark:text-white">
              {(page - 1) * 20 + orders.length}
            </span> 条，共 <span className="font-medium text-[#111418] dark:text-white">{total}</span> 条结果
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded border border-[#e5e7eb] dark:border-[#283545] text-sm font-medium text-[#637588] dark:text-[#9da8b9] bg-white dark:bg-[#101822] hover:bg-[#f3f4f6] dark:hover:bg-[#283545] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <span className="px-3 py-1 text-sm font-medium text-[#111418] dark:text-white">
              第 {page} / {totalPages} 页
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded border border-[#e5e7eb] dark:border-[#283545] text-sm font-medium text-[#637588] dark:text-[#9da8b9] bg-white dark:bg-[#101822] hover:bg-[#f3f4f6] dark:hover:bg-[#283545] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
