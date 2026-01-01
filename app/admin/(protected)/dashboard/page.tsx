"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, TrendingUp, TrendingDown, AlertCircle, Users, DollarSign, ShoppingCart, FileText, Settings, Activity, Play, Pause } from "lucide-react";

interface DashboardStats {
  // 实时状态指标
  totalUsers: number;
  activeUsers24h: number;
  activeMarkets: number;
  pendingWithdrawals: number;
  pendingReviewMarkets: number;
  activeTemplates: number;
  pausedTemplates: number;
  pausedTemplatesDetails: Array<{
  id: string;
  name: string;
    symbol: string;
    period: number;
    pauseReason: string | null;
    failureCount: number;
    updatedAt: string;
  }>;
  factoryStatus: 'RUNNING' | 'STOPPED'; // 自动化工厂运行状态
  oddsRobotStatus: {
    status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
    lastPulse: string | null;
    activePoolSize: number;
    syncEfficiency: number;
    errorMessage: string | null;
  };

  // 今日指标
  todayNewUsers: number;
  todayVolume: number;
  todayOrders: number;
  todayFeeRevenue: number;
  todayMarkets: number;

  // 本周指标
  weekVolume: number;
  weekNewUsers: number;
  weekOrders: number;
  weekFeeRevenue: number;

  // 累计指标
  totalVolume: number;

  // 运营指标
  avgOrderAmount: number;
  activeUserRate: number;

  // 趋势数据
  volumeHistory: Array<{ date: string; value: number }>;
  activeUsersHistory: Array<{ date: string; value: number }>;
  orderHistory: Array<{ date: string; value: number }>;
  timeRange: string;
}

type TimeRange = '7d' | '30d' | '90d' | 'all';

/**
 * 🔥 全局任务开关卡片组件
 */
function SystemStatusCard() {
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);

  // 获取当前状态
  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/system/scheduler-status', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('获取状态失败');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setIsActive(result.data.active);
      }
    } catch (error) {
      console.error('获取调度器状态失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 切换状态
  const toggleStatus = async () => {
    try {
      setIsToggling(true);
      const newStatus = !isActive;
      
      const response = await fetch('/api/admin/system/scheduler-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ active: newStatus }),
      });

      if (!response.ok) {
        throw new Error('更新状态失败');
      }

        const result = await response.json();
        if (result.success) {
        setIsActive(newStatus);
        // 显示成功提示（可以集成 toast）

      }
    } catch (error) {
      console.error('更新调度器状态失败:', error);
      toast.error('更新状态失败，请重试');
    } finally {
      setIsToggling(false);
    }
  };
  
  useEffect(() => {
    fetchStatus();
    // 每10秒自动刷新状态
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className={`rounded-xl border shadow-md p-5 ${
      isActive
        ? 'bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 border-green-200/50 dark:border-green-800/30'
        : 'bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/10 border-orange-200/50 dark:border-orange-800/30'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-lg ${
            isActive ? 'bg-green-500/10' : 'bg-orange-500/10'
          }`}>
            {isActive ? (
              <Activity className="w-6 h-6 text-green-600 dark:text-green-400" />
            ) : (
              <Pause className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#111418] dark:text-white mb-1">
              后台任务全局开关
            </h3>
            <p className="text-sm text-[#637588] dark:text-[#9da8b9]">
              控制所有自动化任务（赔率同步、工厂生成、市场结算等）
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-[#637588] dark:text-[#9da8b9]" />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  isActive ? 'bg-green-500 animate-pulse' : 'bg-orange-500'
                }`}></div>
                <span className={`text-sm font-medium ${
                  isActive ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
                }`}>
                  {isActive ? '🟢 运行中' : '🔴 已暂停'}
                </span>
              </div>
              <button
                onClick={toggleStatus}
                disabled={isToggling}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isActive
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isToggling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    切换中...
                  </>
                ) : isActive ? (
                  <>
                    <Pause className="w-4 h-4" />
                    暂停任务
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    启动任务
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  // 获取统计数据
  const fetchStats = async (range: TimeRange = timeRange) => {
    try {
      setIsLoading(true);
      setError(null);
      const url = `/api/admin/dashboard/stats?timeRange=${range}`;
      const response = await fetch(url, {
        cache: 'no-store',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('获取统计数据失败');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setStats(result.data);
      } else {
        throw new Error(result.error || '获取统计数据失败');
      }
    } catch (err) {
      console.error('获取统计数据失败:', err);
      setError(err instanceof Error ? err.message : '获取统计数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    fetchStats(range);
  };

  // 格式化数字显示
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(2)}M`;
    }
    if (num >= 1000) {
      return `$${(num / 1000).toFixed(2)}K`;
    }
    return `$${num.toFixed(2)}`;
  };

  // 计算趋势百分比
  const calculateTrend = (history: Array<{ date: string; value: number }>): number => {
    if (history.length < 2) return 0;
    const recent = history.slice(-7);
    if (recent.length < 2) return 0;
    const first = recent[0].value;
    const last = recent[recent.length - 1].value;
    if (first === 0) return last > 0 ? 100 : 0;
    return ((last - first) / first) * 100;
  };

  // 渲染趋势图表组件
  const TrendChart = ({ 
    data, 
    color = "#136dec",
    height = 80 
  }: { 
    data: Array<{ date: string; value: number }>; 
    color?: string;
    height?: number;
  }) => {
    if (!data || data.length === 0) {
      return (
        <div className="h-full w-full flex items-end justify-center" style={{ height: `${height}px` }}>
          <svg className="w-full h-full" viewBox="0 0 100 80" preserveAspectRatio="none">
            <path
              d="M0 70 L100 70"
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              strokeOpacity="0.3"
              strokeLinecap="round"
            />
          </svg>
        </div>
      );
    }

    const maxValue = Math.max(...data.map(d => d.value), 1);
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1 || 1)) * 100;
      const y = 90 - (d.value / maxValue) * 70;
      return `${x},${y}`;
    }).join(' L');

    const areaPath = `M0,90 L${points} L100,90 Z`;

    return (
      <div className="w-full" style={{ height: `${height}px` }}>
        <svg className="w-full h-full" viewBox="0 0 100 90" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#gradient-${color.replace('#', '')})`} />
          <path
            d={`M${points}`}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => fetchStats()}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const volumeTrend = calculateTrend(stats.volumeHistory);
  const usersTrend = calculateTrend(stats.activeUsersHistory);
  const ordersTrend = calculateTrend(stats.orderHistory);

  // 计算今日/本周对比
  const volumeChange = stats.weekOrders > 0 
    ? ((stats.todayVolume / stats.weekVolume) * 7 - 1) * 100 
    : 0;

  return (
    <div className="mx-auto max-w-[1800px] flex flex-col gap-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#111418] dark:text-white">运营概览</h1>
          <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">实时监控平台核心运营数据</p>
        </div>
        <button
          onClick={() => fetchStats()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      {/* 🔥 全局任务开关卡片 */}
      <SystemStatusCard />

      {/* ========== 一、实时状态指标（不需要时间范围） ========== */}
      <div>
        <h2 className="text-lg font-semibold text-[#111418] dark:text-white mb-4">实时状态</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 总注册用户数 */}
          <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 border border-blue-200/50 dark:border-blue-800/30 shadow-md p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium mb-1">总注册用户</p>
            <p className="text-2xl font-bold text-[#111418] dark:text-white">
              {stats.totalUsers.toLocaleString()}
            </p>
          </div>

          {/* 活跃用户数（24h） */}
          <div className="rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 border border-green-200/50 dark:border-green-800/30 shadow-md p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium mb-1">活跃用户 (24h)</p>
            <p className="text-2xl font-bold text-[#111418] dark:text-white">
              {stats.activeUsers24h.toLocaleString()}
            </p>
            <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">
              活跃率: {stats.activeUserRate.toFixed(1)}%
            </p>
          </div>

          {/* 活跃市场数 */}
          <div className="rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 border border-purple-200/50 dark:border-purple-800/30 shadow-md p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium mb-1">活跃市场</p>
            <p className="text-2xl font-bold text-[#111418] dark:text-white">
              {stats.activeMarkets}
          </p>
        </div>

          {/* 已上架交易模版（统计已经生成市场且有实际交易的模版） */}
          <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-900/20 dark:to-indigo-800/10 border border-indigo-200/50 dark:border-indigo-800/30 shadow-md p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-indigo-500/10">
                <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
          </div>
            <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium mb-1">已上架交易模版</p>
            <p className="text-2xl font-bold text-[#111418] dark:text-white">
              {stats.activeTemplates}
            </p>
          </div>
        </div>
        </div>

      {/* ========== 二、今日运营指标 ========== */}
      <div>
        <h2 className="text-lg font-semibold text-[#111418] dark:text-white mb-4">今日数据</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 今日新增用户 */}
          <div className="rounded-xl bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-4">
            <p className="text-[#637588] dark:text-[#9da8b9] text-xs font-medium mb-2">今日新增用户</p>
            <p className="text-xl font-bold text-[#111418] dark:text-white">
              +{stats.todayNewUsers}
            </p>
            <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">
              本周: {stats.weekNewUsers}
            </p>
          </div>

          {/* 今日交易量 */}
          <div className="rounded-xl bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-4">
            <p className="text-[#637588] dark:text-[#9da8b9] text-xs font-medium mb-2">今日交易量</p>
            <p className="text-xl font-bold text-[#111418] dark:text-white">
              {formatNumber(stats.todayVolume)}
            </p>
            <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">
              本周: {formatNumber(stats.weekVolume)}
            </p>
          </div>

          {/* 今日订单数 */}
          <div className="rounded-xl bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-4">
            <p className="text-[#637588] dark:text-[#9da8b9] text-xs font-medium mb-2">今日订单数</p>
            <p className="text-xl font-bold text-[#111418] dark:text-white">
              {stats.todayOrders}
            </p>
            <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">
              本周: {stats.weekOrders}
          </p>
        </div>

          {/* 今日手续费收入 */}
          <div className="rounded-xl bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-4">
            <p className="text-[#637588] dark:text-[#9da8b9] text-xs font-medium mb-2">今日手续费</p>
            <p className="text-xl font-bold text-[#111418] dark:text-white">
              {formatNumber(stats.todayFeeRevenue)}
            </p>
            <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">
              本周: {formatNumber(stats.weekFeeRevenue)}
            </p>
          </div>

          {/* 今日生成盘口 */}
          <div className="rounded-xl bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-4">
            <p className="text-[#637588] dark:text-[#9da8b9] text-xs font-medium mb-2">今日生成盘口</p>
            <p className="text-xl font-bold text-[#111418] dark:text-white">
              {stats.todayMarkets}
            </p>
            <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">
              平均订单: {formatNumber(stats.avgOrderAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* ========== 三、核心业务趋势（带时间范围选择） ========== */}
            <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#111418] dark:text-white">业务趋势</h2>
          <div className="flex items-center gap-2 bg-[#f3f4f6] dark:bg-[#101822] rounded-lg p-1">
            {(['7d', '30d', '90d', 'all'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => handleTimeRangeChange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                  timeRange === range
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white'
                }`}
              >
                {range === 'all' ? '全部' : range === '7d' ? '7天' : range === '30d' ? '30天' : '90天'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 交易量趋势 */}
          <div className="lg:col-span-2 rounded-xl bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium">总交易量</p>
                <p className="text-2xl font-bold text-[#111418] dark:text-white mt-1">
                  {formatNumber(stats.totalVolume)}
                </p>
              </div>
              {volumeTrend !== 0 && (
                <div className="flex items-center gap-2">
                  {volumeTrend >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-[#0bda5e]" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-500" />
                  )}
                  <span className={`text-sm font-medium ${volumeTrend >= 0 ? 'text-[#0bda5e]' : 'text-red-500'}`}>
                    {Math.abs(volumeTrend).toFixed(1)}%
                  </span>
                </div>
              )}
              </div>
            <div className="h-[200px]">
              <TrendChart data={stats.volumeHistory} color="#136dec" height={200} />
            </div>
          </div>

          {/* 活跃用户趋势 */}
          <div className="rounded-xl bg-card-light dark:bg-card-dark border border-[#e5e7eb] dark:border-[#283545] shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium">活跃用户趋势</p>
                <p className="text-xl font-bold text-[#111418] dark:text-white mt-1">
                  {stats.activeUsers24h.toLocaleString()}
                </p>
              </div>
              {usersTrend !== 0 && (
                <div className="flex items-center gap-1">
                  {usersTrend >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-[#0bda5e]" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-xs font-medium ${usersTrend >= 0 ? 'text-[#0bda5e]' : 'text-red-500'}`}>
                    {Math.abs(usersTrend).toFixed(1)}%
                  </span>
                </div>
            )}
            </div>
            <div className="h-[200px]">
              <TrendChart data={stats.activeUsersHistory} color="#0bda5e" height={200} />
            </div>
          </div>
        </div>
      </div>

      {/* ========== 四、系统运行状态监控 ========== */}
            <div>
        <h2 className="text-lg font-semibold text-[#111418] dark:text-white mb-4">系统运行状态</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 赔率管理运行状态 */}
          <div className={`rounded-xl border shadow-md p-5 ${
            stats.oddsRobotStatus.status === 'ACTIVE' 
              ? 'bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 border-green-200/50 dark:border-green-800/30'
              : stats.oddsRobotStatus.status === 'ERROR'
              ? 'bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10 border-red-200/50 dark:border-red-800/30'
              : 'bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-900/20 dark:to-gray-800/10 border-gray-200/50 dark:border-gray-800/30'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Activity className={`w-5 h-5 ${
                  stats.oddsRobotStatus.status === 'ACTIVE' ? 'text-green-600 dark:text-green-400' :
                  stats.oddsRobotStatus.status === 'ERROR' ? 'text-red-600 dark:text-red-400' :
                  'text-gray-600 dark:text-gray-400'
                }`} />
            </div>
              <a
                href="/admin/operations/odds"
                className="text-xs text-primary hover:text-blue-600 font-medium"
              >
                查看详情 →
              </a>
            </div>
            <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium mb-1">赔率管理运行状态</p>
            <p className={`text-2xl font-bold mb-2 ${
              stats.oddsRobotStatus.status === 'ACTIVE' ? 'text-green-600 dark:text-green-400' :
              stats.oddsRobotStatus.status === 'ERROR' ? 'text-red-600 dark:text-red-400' :
              'text-gray-600 dark:text-gray-400'
            }`}>
              {stats.oddsRobotStatus.status === 'ACTIVE' ? '运行中' : 
               stats.oddsRobotStatus.status === 'ERROR' ? '异常' : '已停止'}
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[#637588] dark:text-[#9da8b9]">活跃市场池:</span>
                <span className="text-[#111418] dark:text-white font-medium">{stats.oddsRobotStatus.activePoolSize}</span>
          </div>
              <div className="flex justify-between">
                <span className="text-[#637588] dark:text-[#9da8b9]">同步效能:</span>
                <span className="text-[#111418] dark:text-white font-medium">{stats.oddsRobotStatus.syncEfficiency}%</span>
              </div>
              {stats.oddsRobotStatus.lastPulse && (
                <div className="flex justify-between">
                  <span className="text-[#637588] dark:text-[#9da8b9]">最后同步:</span>
                  <span className="text-[#111418] dark:text-white font-medium">
                    {new Date(stats.oddsRobotStatus.lastPulse).toLocaleTimeString('zh-CN', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
            </div>
              )}
              {stats.oddsRobotStatus.errorMessage && (
                <p className="text-red-600 dark:text-red-400 mt-2 truncate" title={stats.oddsRobotStatus.errorMessage}>
                  {stats.oddsRobotStatus.errorMessage}
                </p>
              )}
          </div>
        </div>

          {/* 自动化工厂状态汇总 */}
          <div className={`rounded-xl border shadow-md p-5 ${
            stats.factoryStatus === 'RUNNING'
              ? 'bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 border-green-200/50 dark:border-green-800/30'
              : 'bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-900/20 dark:to-gray-800/10 border-gray-200/50 dark:border-gray-800/30'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${
                stats.factoryStatus === 'RUNNING' ? 'bg-green-500/10' : 'bg-gray-500/10'
              }`}>
                <Settings className={`w-5 h-5 ${
                  stats.factoryStatus === 'RUNNING' ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
                }`} />
            </div>
              <a
                href="/admin/factory"
                className="text-xs text-primary hover:text-blue-600 font-medium"
              >
                查看详情 →
              </a>
            </div>
            <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium mb-1">自动化工厂状态</p>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${
                stats.factoryStatus === 'RUNNING' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}></div>
              <p className={`text-lg font-bold ${
                stats.factoryStatus === 'RUNNING' ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
              }`}>
                {stats.factoryStatus === 'RUNNING' ? '运行中' : '已停止'}
              </p>
          </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[#111418] dark:text-white text-xl font-bold">
                  {stats.activeTemplates}
                </span>
                <span className="text-xs text-[#637588] dark:text-[#9da8b9]">已上架交易模版</span>
              </div>
              {stats.pausedTemplates > 0 && (
                <div className="flex justify-between items-center pt-2 border-t border-purple-200/50 dark:border-purple-800/30">
                  <span className="text-red-600 dark:text-red-400 text-lg font-bold">
                    {stats.pausedTemplates}
                  </span>
                  <span className="text-xs text-[#637588] dark:text-[#9da8b9]">异常熔断</span>
            </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========== 五、待处理事项（需要立即关注） ========== */}
      {(stats.pendingWithdrawals > 0 || stats.pendingReviewMarkets > 0 || stats.pausedTemplates > 0) && (
          <div>
          <h2 className="text-lg font-semibold text-[#111418] dark:text-white mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            待处理事项
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.pendingWithdrawals > 0 && (
              <div className="rounded-xl p-5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/30 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-2 h-full bg-orange-500"></div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <DollarSign className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
        </div>
                <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium mb-1">待处理提现</p>
                <p className="text-2xl font-bold text-[#111418] dark:text-white mb-3">
                  {stats.pendingWithdrawals} 笔
                </p>
                <a
                  href="/admin/withdrawals"
                  className="inline-block px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
                >
                  立即处理
                </a>
              </div>
            )}

            {stats.pendingReviewMarkets > 0 && (
              <div className="rounded-xl p-5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-2 h-full bg-yellow-500"></div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-yellow-500/10">
                    <FileText className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
                <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium mb-1">待审核事件</p>
                <p className="text-2xl font-bold text-[#111418] dark:text-white mb-3">
                  {stats.pendingReviewMarkets} 个
                </p>
                <a
                  href="/admin/markets/review"
                  className="inline-block px-4 py-2 bg-yellow-500 text-white text-sm font-medium rounded-lg hover:bg-yellow-600 transition-colors"
                >
                  去审核
                </a>
              </div>
            )}

            {stats.pausedTemplates > 0 && (
              <div className="rounded-xl p-5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-2 h-full bg-red-500"></div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
            </div>
                <p className="text-[#637588] dark:text-[#9da8b9] text-sm font-medium mb-1">异常熔断模版</p>
                <p className="text-2xl font-bold text-[#111418] dark:text-white mb-2">
                  {stats.pausedTemplates} 个
                </p>
                {stats.pausedTemplatesDetails && stats.pausedTemplatesDetails.length > 0 && (
                  <div className="mb-3 space-y-1 max-h-[100px] overflow-y-auto">
                    {stats.pausedTemplatesDetails.slice(0, 3).map((template) => (
                      <div key={template.id} className="text-xs">
                        <p className="text-[#111418] dark:text-white font-medium truncate">
                          {template.name || `${template.symbol} ${template.period}分钟`}
                        </p>
                        {template.pauseReason && (
                          <p className="text-red-600 dark:text-red-400 truncate" title={template.pauseReason}>
                            {template.pauseReason}
                          </p>
                        )}
                      </div>
                    ))}
                    {stats.pausedTemplatesDetails.length > 3 && (
                      <p className="text-xs text-[#637588] dark:text-[#9da8b9]">
                        还有 {stats.pausedTemplatesDetails.length - 3} 个...
                      </p>
                    )}
          </div>
                )}
                <a
                  href="/admin/factory"
                  className="inline-block px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
                >
                  查看详情
                </a>
            </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
