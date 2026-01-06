"use client";

import Link from "next/link";
import dayjs from "dayjs";
import { useState } from "react";
import { toast } from "sonner";

// 子市场详情接口（后端返回的对象）
interface SubMarketDetail {
  id: string;
  endTime: string; // 结束时间
  externalId?: string | null; // Polymarket ID
  outcomePrices?: string | null; // 赔率数据
  period?: number | null; // 周期（分钟）
}

interface Market {
  id: string;
  title: string;
  status: string;
  volume?: number; // 🔥 修复类型：可选字段（兼容 types/api.Market 的 volume?: number）
  endTime?: string | null;
  templateId?: string;
  stats?: {
    open?: number;
    pending?: number;
    historical?: number;
    total?: number;
    totalActive?: number;
    ended?: number; // 🚀 新增：已结束数量（工厂模式专用）
  };
  tradingStats?: {
    userCount?: number; // 🚀 新增：交易用户数
    orderCount?: number; // 🚀 新增：交易人次
  };
  // 🚀 修改：现在这些数组包含对象而不是字符串
  activeMarketIds?: SubMarketDetail[];
  marketIds?: SubMarketDetail[];
  historicalMarketIds?: SubMarketDetail[];
}

interface MarketTableProps {
  markets: Market[];
  isLoading: boolean;
  error: string | null;
  pagination: any;
  mode: 'manual' | 'factory'; // 🚀 核心：通过 mode 区分显示逻辑
  showDetails: boolean;
  expandedSeries: Set<string>;
  showHistorical: Record<string, boolean>;
  onToggleExpand: (seriesKey: string) => void;
  onToggleHistorical: (seriesKey: string) => void;
  onPageChange: (page: number) => void;
  onDeleteMarket: (marketId: string, marketTitle: string) => void;
  // 🚀 工厂模式专用：计算总场次数（96 或 24）
  getTotalSlots?: (templateId: string) => number;
}

// 格式化日期
const formatDate = (timestamp: string | null | undefined) => {
  if (!timestamp) return "长期开放";
  try {
    const date = dayjs(timestamp);
    if (!date.isValid()) return "长期开放";
    return date.format("YYYY-MM-DD");
  } catch {
    return "长期开放";
  }
};

// 格式化时间
const formatTime = (timestamp: string | null | undefined) => {
  if (!timestamp) return "";
  try {
    const date = dayjs(timestamp);
    if (!date.isValid()) return "";
    return date.format("HH:mm");
  } catch {
    return "";
  }
};

// 格式化开始时间（MM-DD HH:mm）
const formatStartTime = (endTime: string, period?: number | null) => {
  if (!endTime) return "未知";
  try {
    const date = dayjs(endTime);
    if (!date.isValid()) return "未知";
    // 如果有周期，开始时间 = 结束时间 - 周期
    if (period && period > 0) {
      const startDate = date.subtract(period, 'minute');
      return startDate.format("MM-DD HH:mm");
    }
    // 否则使用结束时间（减去15分钟作为默认，因为大多数工厂市场是15分钟周期）
    const startDate = date.subtract(15, 'minute');
    return startDate.format("MM-DD HH:mm");
  } catch {
    return "未知";
  }
};

// 判断市场是否已同步（有 externalId 且有赔率数据）
const isMarketSynced = (market: SubMarketDetail): boolean => {
  const hasExternalId = market.externalId && typeof market.externalId === 'string' && market.externalId.trim() !== '';
  const hasOutcomePrices = market.outcomePrices && typeof market.outcomePrices === 'string' && market.outcomePrices.trim() !== '';
  return Boolean(hasExternalId && hasOutcomePrices);
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

// 🔥 第二步：流动性管理按钮组件
function LiquidityButton({ marketId, marketTitle }: { marketId: string; marketTitle: string }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [action, setAction] = useState<'inject' | 'withdraw'>('inject');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenModal = (actionType: 'inject' | 'withdraw') => {
    setAction(actionType);
    setAmount('');
    setReason('');
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("请输入有效的金额");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/markets/${marketId}/liquidity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action,
          amount: amountNum,
          reason: reason || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || '操作失败');
      }

      toast.success(action === 'inject' ? '流动性注入成功' : '流动性撤回成功');
      setIsModalOpen(false);
      // 刷新页面以更新市场数据
      window.location.reload();
    } catch (error) {
      console.error('流动性操作失败:', error);
      toast.error(error instanceof Error ? error.message : '操作失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex gap-1">
        <button
          onClick={() => handleOpenModal('inject')}
          className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-800 dark:text-purple-400 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
          title="注入流动性"
        >
          <span className="material-symbols-outlined text-[16px]">trending_up</span>
          注入
        </button>
        <button
          onClick={() => handleOpenModal('withdraw')}
          className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 text-orange-800 dark:text-orange-400 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
          title="撤回流动性"
        >
          <span className="material-symbols-outlined text-[16px]">trending_down</span>
          撤回
        </button>
      </div>

      {/* 流动性管理 Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {action === 'inject' ? '注入流动性' : '撤回流动性'} - {marketTitle}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  金额 (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  备注（可选）
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="请输入备注信息..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                disabled={isSubmitting}
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !amount}
                className={`flex-1 py-2 px-4 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  action === 'inject'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                {isSubmitting ? "处理中..." : "确认"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 获取状态显示
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

export default function MarketTable({
  markets,
  isLoading,
  error,
  pagination,
  mode,
  showDetails,
  expandedSeries,
  showHistorical,
  onToggleExpand,
  onToggleHistorical,
  onPageChange,
  onDeleteMarket,
  getTotalSlots,
}: MarketTableProps) {
  return (
    <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#e5e7eb] dark:border-[#283545] bg-[#f9fafb] dark:bg-[#101822]">
              <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">
                {showDetails ? "市场ID" : "系列ID"}
              </th>
              <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider min-w-[300px]">标题</th>
              <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-center">
                {showDetails ? "状态" : "状态统计"}
              </th>
              <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-right">总交易量</th>
              {/* 🚀 核心：根据 mode 显示不同的列 */}
              {mode === 'manual' ? (
                <>
                  <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-center">交易用户/人次</th>
                  <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">结束时间</th>
                </>
              ) : (
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-center">交易用户/人次</th>
              )}
              <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e7eb] dark:divide-[#283545]">
            {/* 加载状态 */}
            {isLoading && (
              <tr>
                <td colSpan={mode === 'manual' ? 7 : 6} className="py-12 text-center">
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
                <td colSpan={mode === 'manual' ? 7 : 6} className="py-12 text-center">
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
                <td colSpan={mode === 'manual' ? 7 : 6} className="py-12 text-center">
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
            {!isLoading && !error && markets.map((market: any) => {
              // 🔥 修复：isAggregated 的判断逻辑
              // 当 showDetails=true 时，后端返回单个市场（不聚合），此时 market.stats 可能仍然存在但应该视为非聚合
              // 当 showDetails=false 时，后端返回聚合数据，此时 market.stats 存在且应该视为聚合
              const isAggregated = !showDetails && market.stats && (market.stats.open !== undefined || market.stats.total !== undefined);
              const statusDisplay = getStatusDisplay(market.status);
              const seriesKey = market.templateId || market.id;
              const isExpanded = expandedSeries.has(seriesKey);
              
              // 🚀 工厂模式：计算已结束数量
              let endedCount = 0;
              let totalSlots = 0;
              if (mode === 'factory' && isAggregated) {
                totalSlots = getTotalSlots ? getTotalSlots(market.templateId || market.id) : 144; // 默认 144（15m，36小时窗口）
                // 🚀 修复：直接使用后端返回的 ended 统计，而不是用 totalSlots - activeCount
                // 因为 totalSlots 是理论值（144），而实际生成的场次可能少于这个数
                endedCount = market.stats?.ended || 0;
              }
              
              return (
                <>
                  <tr key={market.id} className="hover:bg-[#f9fafb] dark:hover:bg-[#1e2a36] transition-colors group">
                    <td className="p-4">
                      <span className="text-sm font-medium text-[#111418] dark:text-white font-mono">
                        {isAggregated ? (market.templateId || market.id).substring(0, 8) + '...' : market.id}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-medium text-[#111418] dark:text-white">{market.title}</span>
                    </td>
                    <td className="p-4 text-center">
                      {isAggregated ? (
                        // 🚀 核心：根据 mode 显示不同的状态统计格式
                        mode === 'manual' ? (
                          // 手动模式：进行中: X | 待结算: Y | 历史: Z
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-center gap-1 flex-wrap text-xs">
                              <span className="text-[#637588] dark:text-[#9da8b9]">
                                进行中: <span className="font-medium text-green-600 dark:text-green-400">{market.stats?.open || 0}</span>
                                {(market.stats?.pending || 0) > 0 || (market.stats?.historical || 0) > 0 ? ' | ' : ''}
                              </span>
                              {(market.stats?.pending || 0) > 0 && (
                                <span className="text-[#637588] dark:text-[#9da8b9]">
                                  待结算: <span className="font-medium text-yellow-600 dark:text-yellow-400">{market.stats?.pending || 0}</span>
                                  {(market.stats?.historical || 0) > 0 ? ' | ' : ''}
                                </span>
                              )}
                              {(market.stats?.historical || 0) > 0 && (
                                <span className="text-[#637588] dark:text-[#9da8b9]">
                                  历史: <span className="font-medium text-gray-500 dark:text-gray-400">{market.stats?.historical || 0}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          // 工厂模式：进行中: X | 已结束: Y（X + Y = total）
                          // 🔧 修复：只统计 OPEN 状态为"进行中"，pending/closed/resolved 等都应该算"已结束"
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-center gap-1 flex-wrap text-xs">
                              <span className="text-[#637588] dark:text-[#9da8b9]">
                                进行中: <span className="font-medium text-green-600 dark:text-green-400">
                                  {market.stats?.open || 0}
                                </span>
                                {' | '}
                              </span>
                              <span className="text-[#637588] dark:text-[#9da8b9]">
                                已结束: <span className="font-medium text-gray-500 dark:text-gray-400">{endedCount}</span>
                              </span>
                            </div>
                            {/* 🚀 总量守恒验证：显示总数，验证 open + ended = total */}
                            <div className="text-xs text-[#637588] dark:text-[#9da8b9] mt-0.5">
                              总计: {market.stats?.total || totalSlots} ({((market.stats?.open || 0) + endedCount === (market.stats?.total || totalSlots)) ? '✓' : '✗'})
                            </div>
                          </div>
                        )
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusDisplay.className}`}>
                          {statusDisplay.text}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-sm font-bold text-[#111418] dark:text-white">{formatCurrency(market.volume)}</span>
                    </td>
                    {/* 🚀 核心：根据 mode 显示不同的列内容 */}
                    {mode === 'manual' ? (
                      <>
                        {/* 🚀 交易用户/人次列（独立列，位于总交易量和结束时间之间） */}
                        <td className="p-4 text-center">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium text-[#111418] dark:text-white">
                              {market.tradingStats?.userCount ?? 0}
                            </span>
                            <span className="text-xs text-[#637588] dark:text-[#9da8b9]">
                              {market.tradingStats?.orderCount ?? 0}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="text-sm text-[#111418] dark:text-white">{formatDate(market.endTime)}</span>
                            {formatTime(market.endTime) && (
                              <span className="text-xs text-[#637588] dark:text-[#9da8b9]">{formatTime(market.endTime)}</span>
                            )}
                          </div>
                        </td>
                      </>
                    ) : (
                      /* 🚀 工厂市场：交易用户/人次列（24小时滚动统计） */
                      <td className="p-4 text-center">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-[#111418] dark:text-white">
                            {market.tradingStats?.userCount ?? 0}
                          </span>
                          <span className="text-xs text-[#637588] dark:text-[#9da8b9]">
                            {market.tradingStats?.orderCount ?? 0}
                          </span>
                        </div>
                      </td>
                    )}
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        {/* 🚀 手动市场：删除"查看场次"按钮 */}
                        {isAggregated && mode === 'factory' && (
                          <button
                            onClick={() => onToggleExpand(seriesKey)}
                            className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-800 dark:text-blue-400 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                            title="查看所有场次"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {isExpanded ? "expand_less" : "expand_more"}
                            </span>
                            {isExpanded ? "收起" : "查看场次"}
                          </button>
                        )}
                        {/* 🔥 第二步：流动性管理按钮（仅手动市场且状态为OPEN时显示） */}
                        {/* 修复：只在详细视图（非聚合）时显示按钮，因为流动性管理是针对单个市场的操作 */}
                        {mode === 'manual' && !isAggregated && market.status === 'OPEN' && (
                          <LiquidityButton marketId={market.id} marketTitle={market.title} />
                        )}
                        <Link
                          href={mode === 'factory' 
                            ? `/admin/markets/edit/${market.id}?backTo=/admin/factory`
                            : `/admin/markets/edit/${market.id}`
                          }
                          className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                          title="编辑"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                          编辑
                        </Link>
                        {market.status !== "RESOLVED" && (
                          <Link
                            href={mode === 'factory'
                              ? `/admin/markets/edit/${market.id}?backTo=/admin/factory`
                              : `/admin/markets/edit/${market.id}`
                            }
                            className="px-3 py-1.5 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-800 dark:text-green-400 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                            title="结算"
                          >
                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                            结算
                          </Link>
                        )}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            onDeleteMarket(market.id, market.title);
                          }}
                          className="px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-800 dark:text-red-400 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                          title="删除"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* 展开显示所有场次（仅工厂市场） */}
                  {isAggregated && isExpanded && mode === 'factory' && (
                    <tr>
                      <td colSpan={6} className="p-4 bg-gray-50 dark:bg-gray-900/50">
                        <div className="text-xs text-[#637588] dark:text-[#9da8b9]">
                          {(market.stats?.historical || 0) > 0 && (
                            <div className="mb-3 flex items-center justify-between">
                              <p className="font-medium text-[#111418] dark:text-white">
                                活跃场次 ({market.activeMarketIds?.length || 0} 个)
                              </p>
                              <button
                                onClick={() => onToggleHistorical(seriesKey)}
                                className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-xs font-medium text-[#111418] dark:text-white transition-colors"
                              >
                                {showHistorical[seriesKey] ? '隐藏历史记录' : `查看历史记录 (${market.stats?.historical || 0} 个)`}
                              </button>
                            </div>
                          )}
                          
                          <div className="mb-2">
                            {((market.activeMarketIds && market.activeMarketIds.length > 0) || 
                              (market.marketIds && market.marketIds.length > 0)) ? (
                              <div className="flex flex-wrap gap-2">
                                {(market.activeMarketIds || market.marketIds || []).map((marketDetail: SubMarketDetail | string) => {
                                  // 🚀 兼容处理：如果后端返回的是字符串（旧格式），则创建一个基本对象
                                  const detail: SubMarketDetail = typeof marketDetail === 'string' 
                                    ? { id: marketDetail, endTime: '', period: null, externalId: null, outcomePrices: null }
                                    : marketDetail;
                                  
                                  const isSynced = isMarketSynced(detail);
                                  const timeLabel = detail.endTime 
                                    ? formatStartTime(detail.endTime, detail.period || null)
                                    : detail.id.substring(0, 8) + '...';
                                  
                                  // 样式：未同步显示红色，已同步显示绿色边框
                                  const cardClassName = !isSynced
                                    ? "px-2 py-1 bg-red-100 dark:bg-red-900/30 border-2 border-red-500 dark:border-red-600 text-red-900 dark:text-red-300 rounded font-medium text-xs hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                    : "px-2 py-1 bg-white dark:bg-gray-800 border-2 border-green-400 dark:border-green-600 text-gray-900 dark:text-gray-100 rounded font-medium text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors";
                                  
                                  return (
                                  <Link
                                    key={detail.id}
                                    href={mode === 'factory'
                                      ? `/admin/markets/edit/${detail.id}?backTo=/admin/factory`
                                      : `/admin/markets/edit/${detail.id}`
                                    }
                                      className={cardClassName}
                                      title={`同步状态: ${isSynced ? '已同步' : '未同步'}`}
                                  >
                                      {timeLabel}
                                  </Link>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-gray-400 dark:text-gray-500 text-xs">暂无活跃场次</p>
                            )}
                          </div>
                          
                          {showHistorical[seriesKey] && (market.stats?.historical || 0) > 0 && market.historicalMarketIds && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <p className="font-medium text-gray-500 dark:text-gray-400 mb-2">
                                历史记录 ({market.historicalMarketIds.length} 个)
                              </p>
                                <div className="flex flex-wrap gap-2">
                                  {market.historicalMarketIds.map((marketDetail: SubMarketDetail | string) => {
                                    // 🚀 兼容处理：如果后端返回的是字符串（旧格式），则创建一个基本对象
                                    const detail: SubMarketDetail = typeof marketDetail === 'string' 
                                      ? { id: marketDetail, endTime: '', period: null, externalId: null, outcomePrices: null }
                                      : marketDetail;
                                    
                                    const isSynced = isMarketSynced(detail);
                                    const timeLabel = detail.endTime 
                                      ? formatStartTime(detail.endTime, detail.period || null)
                                      : detail.id.substring(0, 8) + '...';
                                    
                                    // 历史记录的样式：未同步显示红色，已同步显示默认灰色
                                    const cardClassName = !isSynced
                                      ? "px-2 py-1 bg-red-100 dark:bg-red-900/30 border-2 border-red-500 dark:border-red-600 text-red-900 dark:text-red-300 rounded font-medium text-xs hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                      : "px-2 py-1 bg-gray-100 dark:bg-gray-900 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-800 font-medium text-xs text-gray-500 dark:text-gray-400 transition-colors";
                                    
                                    return (
                                    <Link
                                      key={detail.id}
                                      href={mode === 'factory'
                                        ? `/admin/markets/edit/${detail.id}?backTo=/admin/factory`
                                        : `/admin/markets/edit/${detail.id}`
                                      }
                                        className={cardClassName}
                                        title={`同步状态: ${isSynced ? '已同步' : '未同步'}`}
                                    >
                                        {timeLabel}
                                    </Link>
                                    );
                                  })}
                                </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
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
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1 rounded border border-[#e5e7eb] dark:border-[#283545] text-sm font-medium text-[#637588] dark:text-[#9da8b9] bg-white dark:bg-[#101822] hover:bg-[#f3f4f6] dark:hover:bg-[#283545] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              上一页
            </button>
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
                  onClick={() => onPageChange(pageNum)}
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
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 rounded border border-[#e5e7eb] dark:border-[#283545] text-sm font-medium text-[#637588] dark:text-[#9da8b9] bg-white dark:bg-[#101822] hover:bg-[#f3f4f6] dark:hover:bg-[#283545] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
