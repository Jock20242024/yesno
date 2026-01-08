'use client';

// 🔥 强制动态渲染：防止构建时数据请求失败
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  TrendingUp, 
  DollarSign, 
  CheckCircle2, 
  ArrowUp, 
  ArrowDown 
} from 'lucide-react';
import DepositModal from '@/components/modals/DepositModal';
import WithdrawModal from '@/components/modals/WithdrawModal';
import { formatUSD } from '@/lib/utils';
import { useAuth } from '@/components/providers/AuthProvider';
import { useLanguage } from '@/i18n/LanguageContext';
import { useUserOrders } from '@/hooks/useUserOrders';

// 定义时间范围类型
type TimeRange = '1D' | '1W' | '1M' | '1Y';

export default function WalletPage() {
  const { currentUser, isLoggedIn } = useAuth();
  const { t } = useLanguage();
  
  // 状态管理
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'positions' | 'history' | 'funding'>('positions');
  const [timeRange, setTimeRange] = useState<TimeRange>('1D');

  // ========== 架构加固：只从单一权威 API 获取资产数据 ==========
  // 钱包页只依赖 GET /api/user/assets，禁止其他数据源
  // 新用户/空数据支持：assetsData 可为 null，UI 会显示 0 或空状态
  const [assetsData, setAssetsData] = useState<{
    availableBalance: number;
    frozenBalance: number;
    positionsValue: number;
    totalBalance: number;
    totalEquity: number;
    lockedBalance?: number;
    historical: {
      '1D': { balance: number; profit: { value: number; percent: number; isPositive: boolean } | null };
      '1W': { balance: number; profit: { value: number; percent: number; isPositive: boolean } | null };
      '1M': { balance: number; profit: { value: number; percent: number; isPositive: boolean } | null };
      '1Y': { balance: number; profit: { value: number; percent: number; isPositive: boolean } | null };
    };
  } | null>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);

  // ========== 架构加固：只从 API 获取持仓数据 ==========
  // 钱包页只依赖 GET /api/positions，禁止其他数据源
  const [apiPositions, setApiPositions] = useState<any[]>([]);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);

  // ========== 架构加固：只从 API 获取资金记录 ==========
  // 钱包页只依赖 GET /api/transactions，禁止其他数据源
  const [fundingRecords, setFundingRecords] = useState<any[]>([]);
  const [isLoadingFunding, setIsLoadingFunding] = useState(false);

  // ========== 架构加固：只从 API 获取交易历史（订单数据） ==========
  // 钱包页只依赖 GET /api/orders/user，禁止其他数据源
  const { orders: userOrders, isLoading: isLoadingOrders } = useUserOrders();

  // 获取资产汇总数据
  // 🔥 关键修复：即使 API 失败也允许页面渲染，不阻塞 UI
  useEffect(() => {
    const fetchAssets = async () => {
      // 🔥 修复：不在数据加载前阻止页面渲染，允许基础 UI 显示
      // 即使 isLoggedIn 或 currentUser 暂时为 false/null，也允许页面渲染
      
      setIsLoadingAssets(true);
      try {
        const response = await fetch('/api/user/assets', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store', // 禁用缓存
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setAssetsData(result.data);
            // 架构加固：只从 API 获取，不计算
          } else {
            // 🔥 修复：API 返回失败时，使用函数式更新保持之前的 assetsData（如果有）
            // 这样即使 API 临时失败，用户仍能看到之前的资产数据
            setAssetsData(prev => prev ?? null);
          }
        } else {
          // 🔥 修复：HTTP 错误时，使用函数式更新保持之前的 assetsData（如果有）
          setAssetsData(prev => prev ?? null);
        }
      } catch (error) {
        console.error('❌ [WalletPage] 获取资产数据失败:', error);
        // 🔥 修复：网络错误时，使用函数式更新保持之前的 assetsData（如果有）
        // 这样即使网络临时中断，用户仍能看到之前的资产数据
        setAssetsData(prev => prev ?? null);
      } finally {
        setIsLoadingAssets(false);
      }
    };

    // 🔥 修复：只在有用户信息时才请求数据，但不阻止页面渲染
    if (isLoggedIn && currentUser?.id) {
      fetchAssets();
    }
  }, [isLoggedIn, currentUser?.id]);

  // 持仓状态筛选
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'RESOLVED'>('ACTIVE');

  // 获取持仓数据
  useEffect(() => {
    const fetchPositions = async () => {
      if (!isLoggedIn || !currentUser?.id) {
        setApiPositions([]);
        return;
      }

      setIsLoadingPositions(true);
      try {
        // 根据筛选状态调用不同的 API 参数
        const type = statusFilter === 'ACTIVE' ? 'active' : 'history';
        const response = await fetch(`/api/positions?type=${type}`, {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setApiPositions(result.data);
            // 架构加固：只从 API 获取，不计算
          } else {
            setApiPositions([]);
          }
        } else {
          setApiPositions([]);
        }
      } catch (error) {
        // 架构加固：错误时设置为空数组，UI 会显示"暂无持仓"
        setApiPositions([]);
      } finally {
        setIsLoadingPositions(false);
      }
    };

    fetchPositions();
  }, [isLoggedIn, currentUser?.id, statusFilter]);

  // 获取资金记录
  useEffect(() => {
    const fetchFunding = async () => {
      if (!isLoggedIn || !currentUser?.id) {
        setFundingRecords([]);
        return;
      }

      setIsLoadingFunding(true);
      try {
        const response = await fetch('/api/transactions', {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            // ========== 修复：转换 API 数据格式 ==========
            const deposits = (result.data.deposits || []).map((d: any) => ({
              id: d.id,
              type: t('portfolio.types.deposit'),
              amount: Number(d.amount) || 0,
              network: 'Ethereum',
              status: d.status === 'COMPLETED' ? t('portfolio.status.success') : 
                     d.status === 'PENDING' ? t('portfolio.status.pending') : t('portfolio.status.failed'),
              statusKey: d.status === 'COMPLETED' ? 'COMPLETED' : d.status === 'PENDING' ? 'PENDING' : 'FAILED',
              time: new Date(d.createdAt).toLocaleString('zh-CN'),
            }));
            
            const withdrawals = (result.data.withdrawals || []).map((w: any) => ({
              id: w.id,
              type: t('portfolio.types.withdraw'),
              amount: Number(w.amount) || 0,
              network: 'Ethereum',
              status: w.status === 'COMPLETED' ? t('portfolio.status.success') : 
                      w.status === 'PENDING' ? t('portfolio.status.pending') : t('portfolio.status.failed'),
              statusKey: w.status === 'COMPLETED' ? 'COMPLETED' : w.status === 'PENDING' ? 'PENDING' : 'FAILED',
              time: new Date(w.createdAt).toLocaleString('zh-CN'),
            }));
            
            // 合并并按时间排序
            const allRecords = [...deposits, ...withdrawals].sort((a, b) => 
              new Date(b.time).getTime() - new Date(a.time).getTime()
            );
            
            setFundingRecords(allRecords);
            // 架构加固：只从 API 获取，不计算
          } else {
            setFundingRecords([]);
          }
        } else {
          setFundingRecords([]);
        }
      } catch (error) {
        // 架构加固：错误时设置为空数组，UI 会显示"暂无资金记录"
        setFundingRecords([]);
      } finally {
        setIsLoadingFunding(false);
      }
    };

    fetchFunding();
  }, [isLoggedIn, currentUser?.id, t]);

  // ========== 架构加固：只从 API 获取，不计算 ==========
  // 前端禁止参与业务计算，所有字段直接从 API 返回的数据中读取
  const totalBalance = assetsData?.totalEquity ?? assetsData?.totalBalance ?? 0;
  const availableBalance = assetsData?.availableBalance ?? 0;
  const positionsValue = assetsData?.positionsValue ?? 0;
  const frozenBalance = assetsData?.frozenBalance ?? 0;

  // ========== 架构加固：只从 API 获取历史收益，不计算 ==========
  // 前端禁止参与业务计算，所有收益数据直接从 API 返回
  // 新用户/空数据支持：profit 可为 null，此时显示 0
  const currentPnl = assetsData?.historical?.[timeRange]?.profit ?? {
    value: 0,
    percent: 0,
    isPositive: true,
  };

  // ========== 架构加固：只做数据映射，不计算 ==========
  // 前端禁止参与业务计算，只从 API 获取并映射字段
  const positions = useMemo(() => {
    return apiPositions.map((pos) => {
      // 只映射 API 返回的字段，不计算
      // 🔥 修复：优先使用costBasis（实际投入金额）计算avgPrice，确保账目自洽
      const costBasis = (pos as any).costBasis && (pos as any).costBasis > 0 
        ? (pos as any).costBasis 
        : (pos.avgPrice || 0) * (pos.shares || 0);
      const correctAvgPrice = (pos.shares || 0) > 0 && costBasis > 0
        ? costBasis / (pos.shares || 0)
        : (pos.avgPrice || 0);
      
      return {
        id: pos.id?.toString() || `${pos.marketId}-${pos.outcome}`,
        event: pos.marketTitle || `${t('portfolio.table.market')} ${pos.marketId}`,
        type: (pos.outcome || 'YES').toUpperCase(),
        shares: pos.shares || 0,
        avgPrice: correctAvgPrice, // 🔥 修复：使用计算出的正确avgPrice
        value: pos.currentValue || 0, // 直接使用 API 返回的 currentValue
        pnl: pos.profitLoss || 0, // 直接使用 API 返回的 profitLoss
        pnlPercent: pos.profitLossPercent || 0, // 直接使用 API 返回的 profitLossPercent
        status: pos.status || 'OPEN',
        marketId: pos.marketId?.toString() || pos.marketId,
        costBasis: costBasis, // 🔥 新增：保存costBasis用于前端显示
      };
    });
  }, [apiPositions, t]);

  // ========== 架构加固：从 API 获取交易历史（订单数据） ==========
  // 🔥 修复：将订单数据转换为交易历史格式
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // 🔥 修复：获取订单数据并转换为交易历史格式
  useEffect(() => {
    const fetchHistory = async () => {
      if (!isLoggedIn || !currentUser?.id || isLoadingOrders) {
        setHistory([]);
        return;
      }

      if (userOrders.length === 0) {
        setHistory([]);
        return;
      }

      setIsLoadingHistory(true);
      try {
        // 为每个订单获取市场标题
        const historyItems = await Promise.all(
          userOrders.map(async (order) => {
            let marketTitle = `市场 ${order.marketId.slice(0, 8)}`;
            try {
              const response = await fetch(`/api/markets/${order.marketId}`);
              if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                  marketTitle = result.data.title;
                }
              }
            } catch (error) {
              console.error('Error fetching market title:', error);
            }

            // 🔥 修复：使用订单表中的 filledAmount 字段（实际成交的份额数）
            // filledAmount 是 MARKET 订单实际成交的份额，LIMIT 订单为 0
            const shares = (order as any).filledAmount || 0;
            // 计算净投入金额（扣除手续费后的金额）
            const netAmount = order.amount - (order.feeDeducted || 0);
            // 计算平均价格（如果有份额，使用净投入金额/份额；否则使用订单金额/订单金额=1）
            const avgPrice = shares > 0 ? (netAmount / shares) : 0;
            // 执行价格（如果有执行价格字段，否则使用平均价格）
            const executionPrice = (order as any).executionPrice || avgPrice;

            return {
              id: order.id,
              date: new Date(order.createdAt).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              }),
              event: marketTitle,
              action: (order as any).orderType === 'MARKET' 
                ? (order.outcomeSelection === 'YES' ? '买入 YES' : '买入 NO')
                : (order.outcomeSelection === 'YES' ? '限价买入 YES' : '限价买入 NO'),
              price: executionPrice > 0 ? executionPrice : avgPrice, // 使用执行价格，如果没有则使用平均价格
              shares: shares, // 🔥 使用 filledAmount（实际成交的份额数）
              value: order.amount, // 订单总金额
              pnl: (order as any).profitLoss || 0, // 如果有盈亏字段
              status: (order as any).status === 'FILLED' ? '成功' : (order as any).status === 'PENDING' ? '待成交' : '失败',
              marketId: order.marketId,
              orderType: (order as any).orderType || 'MARKET', // 🔥 保存订单类型用于显示
            };
          })
        );

        // 按时间倒序排序（最新的在前）
        historyItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setHistory(historyItems);
      } catch (error) {
        console.error('Error fetching history:', error);
        setHistory([]);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [userOrders, isLoadingOrders, isLoggedIn, currentUser?.id]);

  // 渲染函数 - 持仓列表
  const renderPositions = () => {
    return (
      <div className="overflow-x-auto p-4">
        {/* 筛选按钮 - 🔥 修复：始终显示，即使没有持仓 */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              statusFilter === 'ACTIVE'
                ? 'bg-pm-green/20 text-pm-green border border-pm-green/30'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300 border border-zinc-700'
            }`}
          >
            {t('portfolio.status.active')}
          </button>
          <button
            onClick={() => setStatusFilter('RESOLVED')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              statusFilter === 'RESOLVED'
                ? 'bg-pm-green/20 text-pm-green border border-pm-green/30'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-300 border border-zinc-700'
            }`}
          >
            {t('portfolio.status.resolved')}
          </button>
        </div>

        {/* 加载状态 */}
        {isLoadingPositions && (
          <div className="flex items-center justify-center py-12">
            <div className="text-zinc-500 text-sm">{t('portfolio.empty.loading')}</div>
          </div>
        )}

        {/* 空状态 */}
        {!isLoadingPositions && positions.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="text-zinc-600">
              {statusFilter === 'ACTIVE' ? t('portfolio.empty.no_positions_active') : t('portfolio.empty.no_positions_resolved')}
            </div>
          </div>
        )}

        {/* 持仓列表 */}
        {!isLoadingPositions && positions.length > 0 && (
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500 bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3 font-medium">{t('portfolio.table.event')}</th>
                <th className="px-4 py-3 font-medium text-center">{t('portfolio.table.type')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('portfolio.table.shares')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('portfolio.table.avg_price')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('portfolio.table.current_value')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('portfolio.table.pnl')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {positions.map((pos) => (
                <tr key={pos.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-4 text-zinc-200 max-w-[200px] truncate">
                    <Link 
                      href={`/markets/${pos.marketId}`}
                      className="hover:text-white hover:underline decoration-zinc-500 underline-offset-4 cursor-pointer transition-colors"
                    >
                      {pos.event}
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      pos.type === 'YES' 
                        ? 'bg-pm-green/20 text-pm-green' 
                        : 'bg-pm-red/20 text-pm-red'
                    }`}>
                      {pos.type}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right text-zinc-300 font-mono">{pos.shares.toFixed(2)}</td>
                  <td className="px-4 py-4 text-right font-mono">${pos.avgPrice.toFixed(2)}</td>
                  <td className="px-4 py-4 text-right text-white font-medium font-mono">${pos.value.toFixed(2)}</td>
                  <td className={`px-4 py-4 text-right font-medium font-mono ${
                    pos.pnl >= 0 ? 'text-pm-green' : 'text-pm-red'
                  }`}>
                    {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)} ({pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  };

  // 渲染函数 - 交易历史
  const renderHistory = () => {
    if (isLoadingHistory || isLoadingOrders) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-zinc-500 text-sm">{t('portfolio.empty.loading')}</div>
        </div>
      );
    }

    if (history.length === 0) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-zinc-600">{t('portfolio.empty.no_history')}</div>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto p-4">
        <table className="w-full text-left text-sm text-zinc-400">
          <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500 bg-zinc-900/50">
            <tr>
              <th className="px-4 py-3 font-medium">{t('portfolio.table.time')}</th>
              <th className="px-4 py-3 font-medium">{t('portfolio.table.market')}</th>
              <th className="px-4 py-3 font-medium">{t('portfolio.table.action')}</th>
              <th className="px-4 py-3 font-medium text-right">{t('portfolio.table.price')}</th>
              <th className="px-4 py-3 font-medium text-right">{t('portfolio.table.quantity')}</th>
              <th className="px-4 py-3 font-medium text-right">{t('portfolio.table.total')}</th>
              <th className="px-4 py-3 font-medium text-right">{t('portfolio.table.pnl')}</th>
              <th className="px-4 py-3 font-medium text-right">{t('portfolio.table.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {history.map((item) => (
              <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-4 py-4 text-xs font-mono">{item.date}</td>
                <td className="px-4 py-4 text-zinc-200 max-w-[200px] truncate">
                  <Link 
                    href={`/markets/${item.marketId}`}
                    className="hover:text-white hover:underline decoration-zinc-500 underline-offset-4 cursor-pointer transition-colors"
                  >
                    {item.event}
                  </Link>
                </td>
                <td className="px-4 py-4">
                  <span className={`text-xs px-2 py-0.5 rounded border ${
                    item.action.includes('买入') 
                      ? 'border-pm-green/30 text-pm-green' 
                      : item.action.includes('卖出') 
                        ? 'border-pm-red/30 text-pm-red' 
                        : 'border-zinc-700 text-zinc-400'
                  }`}>
                    {item.action}
                  </span>
                </td>
                <td className="px-4 py-4 text-right font-mono">
                  {item.price > 0 ? `$${item.price.toFixed(2)}` : '-'}
                </td>
                <td className="px-4 py-4 text-right font-mono">{item.shares.toFixed(2)}</td>
                <td className="px-4 py-4 text-right text-white font-mono">${item.value.toFixed(2)}</td>
                <td className={`px-4 py-4 text-right font-medium font-mono ${
                  (item.pnl ?? 0) > 0 ? 'text-pm-green' : (item.pnl ?? 0) < 0 ? 'text-pm-red' : 'text-zinc-500'
                }`}>
                  {(item.pnl ?? 0) === 0 ? '-' : (item.pnl ?? 0) > 0 ? '+' : ''}{formatUSD(item.pnl ?? 0)}
                </td>
                <td className="px-4 py-4 text-right flex justify-end items-center gap-1">
                  {item.status === '成功' || item.status === '已结算' || item.status === 'Success' || item.status === 'Completed' ? (
                    <CheckCircle2 size={14} className="text-pm-green" />
                  ) : (
                    <CheckCircle2 size={14} className="text-zinc-500" />
                  )}
                  <span className="text-xs">{item.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderFunding = () => {
    if (isLoadingFunding) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-zinc-500 text-sm">{t('portfolio.empty.loading')}</div>
        </div>
      );
    }

    if (fundingRecords.length === 0) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-zinc-600">{t('portfolio.empty.no_funding')}</div>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto p-4">
        <table className="w-full text-left text-sm text-zinc-400">
          <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500 bg-zinc-900/50">
            <tr>
              <th className="px-4 py-3 font-medium">{t('portfolio.table.time')}</th>
              <th className="px-4 py-3 font-medium">{t('portfolio.table.type')}</th>
              <th className="px-4 py-3 font-medium">{t('portfolio.table.network')}</th>
              <th className="px-4 py-3 font-medium text-right">{t('portfolio.table.amount')}</th>
              <th className="px-4 py-3 font-medium text-right">{t('portfolio.table.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {fundingRecords.map((item) => (
              <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="px-4 py-4 text-xs font-mono">{item.time}</td>
                <td className="px-4 py-4 text-white font-medium">{item.type}</td>
                <td className="px-4 py-4 text-zinc-400">{item.network}</td>
                <td className={`px-4 py-4 text-right font-bold font-mono ${
                  (item as any).type === t('portfolio.types.deposit') ? 'text-pm-green' : 'text-zinc-200'
                }`}>
                  {(item as any).type === t('portfolio.types.deposit') ? '+' : '-'}${item.amount.toFixed(2)}
                </td>
                <td className="px-4 py-4 text-right">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    (item as any).statusKey === 'COMPLETED'
                      ? 'bg-green-500/10 text-green-400' 
                      : 'bg-yellow-500/10 text-yellow-400'
                  }`}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="flex-1 max-w-[1600px] mx-auto w-full p-4 md:p-6 lg:p-8">
      {/* 1. 顶部资产卡片区域 */}
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6 lg:p-8 backdrop-blur-sm mb-8">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          {/* 左侧：金额信息 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <Wallet size={18} />
              <span className="text-sm font-medium">{t('portfolio.stats.total_value')}</span>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                {isLoadingAssets ? (
                  <span className="text-5xl font-bold text-white tracking-tight">{t('portfolio.stats.loading')}</span>
                ) : (
                  <>
                    {/* 架构加固：新用户/空数据支持，totalBalance 为 0 时显示 $0.00 */}
                    <span className="text-5xl font-bold text-white tracking-tight">
                      {formatUSD(totalBalance)}
                    </span>
                    <span className="text-xl text-zinc-500 font-medium">USD</span>
                  </>
                )}
              </div>
              {/* 盈亏显示 - 架构加固：新用户/空数据支持，profit 为 null 或 0 时显示 $0.00 (0.00%) */}
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-1 text-sm font-bold px-2 py-1 rounded-md ${
                  currentPnl.isPositive 
                    ? 'bg-green-500/10 text-green-400' 
                    : 'bg-red-500/10 text-red-400'
                }`}>
                  {currentPnl.isPositive ? <ArrowUp size={14}/> : <ArrowDown size={14}/>}
                  ${Math.abs(currentPnl.value).toFixed(2)} ({currentPnl.percent.toFixed(2)}%)
                </div>
                <span className="text-xs text-zinc-500">{t('portfolio.stats.past')} {timeRange}</span>
              </div>
            </div>
            <div className="flex gap-6 text-sm pt-2">
              {/* 架构加固：新用户/空数据支持，显示 $0.00 而不是崩溃 */}
              <div>
                <span className="text-zinc-500 block mb-0.5">{t('portfolio.stats.available')}</span>
                <span className="text-white font-mono">{formatUSD(availableBalance)}</span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-0.5">{t('portfolio.stats.position_value')}</span>
                <span className="text-white font-mono">{formatUSD(positionsValue)}</span>
              </div>
            </div>
          </div>
          
          {/* 右侧：操作区域 */}
          <div className="flex flex-col gap-4 w-full md:w-auto">
            {/* 时间筛选器 */}
            <div className="flex bg-zinc-950 rounded-lg p-1 border border-zinc-800 w-fit self-start md:self-end">
              {(['1D', '1W', '1M', '1Y'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    timeRange === range 
                      ? 'bg-zinc-800 text-white shadow-sm' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
            {/* 充提按钮 */}
            <div className="flex gap-3">
              <button 
                onClick={() => setIsDepositOpen(true)}
                className="flex-1 md:flex-none px-6 py-3 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors min-w-[120px]"
              >
                <ArrowDownLeft size={18} />
                {t('portfolio.stats.deposit')}
              </button>
              <button 
                onClick={() => setIsWithdrawOpen(true)}
                className="flex-1 md:flex-none px-6 py-3 bg-zinc-800 text-white hover:bg-zinc-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors min-w-[120px]"
              >
                <ArrowUpRight size={18} />
                {t('portfolio.stats.withdraw')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 下方 Tab 内容 */}
      <div className="space-y-4">
        <div className="flex items-center gap-6 border-b border-zinc-800 px-1">
          <button 
            onClick={() => setActiveTab('positions')} 
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'positions' 
                ? 'border-white text-white' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <TrendingUp size={16} /> {t('portfolio.tabs.positions')}
          </button>
          <button 
            onClick={() => setActiveTab('history')} 
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'history' 
                ? 'border-white text-white' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <History size={16} /> {t('portfolio.tabs.history')}
          </button>
          <button 
            onClick={() => setActiveTab('funding')} 
            className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'funding' 
                ? 'border-white text-white' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <DollarSign size={16} /> {t('portfolio.tabs.funding')}
          </button>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden min-h-[400px]">
          {activeTab === 'positions' && renderPositions()}
          {activeTab === 'history' && renderHistory()} 
          {activeTab === 'funding' && renderFunding()}
        </div>
      </div>

      {/* 3. 模态框 */}
      <DepositModal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} />
      <WithdrawModal isOpen={isWithdrawOpen} onClose={() => setIsWithdrawOpen(false)} availableBalance={availableBalance} />
    </div>
  );
}
