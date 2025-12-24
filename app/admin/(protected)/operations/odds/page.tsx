"use client";

import { useState, useEffect } from "react";
import { Activity, Gauge, RefreshCw, Play, AlertCircle, CheckCircle2, Clock } from "lucide-react";

interface FailedMarket {
  marketId: string;
  marketTitle: string;
  externalId: string;
  reason: string;
}

interface OddsRobotStats {
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  activePoolSize: number;
  factoryCount?: number; // 🔥 工厂市场数量
  manualCount?: number; // 🔥 手动/其他市场数量
  lastPulse: string | null;
  successRate: number;
  itemsCount: number;
  errorMessage: string | null;
  failedMarkets?: FailedMarket[]; // 🔥 失败的市场列表
  nextRunAt: string | null;
  recentLogs: Array<{
    id: string;
    actionType: string;
    details: string;
    timestamp: string;
  }>;
}

export default function OddsMonitoringPage() {
  const [stats, setStats] = useState<OddsRobotStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // 获取统计数据
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/odds-robot/stats', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 手动重启机器人
  const handleRestart = async () => {
    setIsRestarting(true);
    try {
      const response = await fetch('/api/admin/odds-robot/restart', {
        method: 'POST',
        credentials: 'include',
      });

      const result = await response.json();
      if (result.success) {
        alert('机器人已标记为重启');
        // 刷新统计数据
        await fetchStats();
      } else {
        alert(`重启失败: ${result.error}`);
      }
    } catch (error) {
      console.error('Error restarting robot:', error);
      alert('重启失败，请稍后重试');
    } finally {
      setIsRestarting(false);
    }
  };

  // 立即强制更新
  const handleForceUpdate = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch('/api/admin/odds-robot/force-update', {
        method: 'POST',
        credentials: 'include',
      });

      const result = await response.json();
      if (result.success) {
        alert('强制更新已触发');
        // 刷新统计数据
        await fetchStats();
      } else {
        alert(`强制更新失败: ${result.error}`);
      }
    } catch (error) {
      console.error('Error forcing update:', error);
      alert('强制更新失败，请稍后重试');
    } finally {
      setIsUpdating(false);
    }
  };

  // 组件加载时获取数据
  useEffect(() => {
    fetchStats();
    
    // 每 3 秒刷新一次
    const interval = setInterval(() => {
      fetchStats();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // 格式化时间
  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '从未运行';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 格式化相对时间
  const formatRelativeTime = (timestamp: string | null) => {
    if (!timestamp) return '从未运行';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (seconds < 60) return `${seconds} 秒前`;
    if (minutes < 60) return `${minutes} 分钟前`;
    if (hours < 24) return `${hours} 小时前`;
    return formatTime(timestamp);
  };

  return (
    <div className="mx-auto max-w-[1400px] flex flex-col gap-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111418] dark:text-white">赔率监控中心</h1>
          <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">实时监控赔率机器人运行状态和同步数据</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRestart}
            disabled={isRestarting}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isRestarting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>重启中...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>手动重启机器人</span>
              </>
            )}
          </button>
          <button
            onClick={handleForceUpdate}
            disabled={isUpdating}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>更新中...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>立即强制更新</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            <p className="text-[#637588] dark:text-[#9da8b9]">加载统计数据...</p>
          </div>
        </div>
      )}

      {/* 统计数据卡片 */}
      {!isLoading && stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 状态卡片 */}
            <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-[#637588] dark:text-[#9da8b9]">运行状态</h3>
                {stats.status === 'ACTIVE' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : stats.status === 'ERROR' ? (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                ) : (
                  <Clock className="w-5 h-5 text-gray-500" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <Gauge className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold text-[#111418] dark:text-white">
                    {stats.status === 'ACTIVE' ? '运行中' : stats.status === 'ERROR' ? '错误' : '已停止'}
                  </p>
                  <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">
                    {stats.status === 'ERROR' && stats.errorMessage 
                      ? `错误: ${stats.errorMessage.substring(0, 50)}${stats.errorMessage.length > 50 ? '...' : ''}` 
                      : stats.status === 'ACTIVE' 
                        ? '系统运行平稳' 
                        : '系统已停止'}
                  </p>
                </div>
              </div>
            </div>

            {/* 效能卡片 */}
            <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-[#637588] dark:text-[#9da8b9]">同步效能</h3>
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <p className="text-2xl font-bold text-[#111418] dark:text-white">
                    {stats.successRate}%
                  </p>
                  <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">成功率</p>
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold text-[#111418] dark:text-white">
                    {stats.itemsCount}
                  </p>
                  <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">已处理数量</p>
                </div>
              </div>
            </div>

            {/* 池规模卡片 */}
            <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-[#637588] dark:text-[#9da8b9]">活跃市场池</h3>
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <p className="text-2xl font-bold text-[#111418] dark:text-white">
                    {stats.activePoolSize}
                  </p>
                  <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">活跃市场数量</p>
                  {/* 🔥 显示工厂 vs 手动市场分类 */}
                  {(stats.factoryCount !== undefined || stats.manualCount !== undefined) && (
                    <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-2 pt-2 border-t border-[#e5e7eb] dark:border-[#283545]">
                      🏭 工厂: {stats.factoryCount ?? 0} | 👤 手动: {stats.manualCount ?? 0}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 时间信息卡片 */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6">
            <h3 className="text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-4">时间信息</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[#637588] dark:text-[#9da8b9] mb-1">最后同步时间</p>
                <p className="text-sm font-medium text-[#111418] dark:text-white">
                  {formatTime(stats.lastPulse)}
                </p>
                <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">
                  {formatRelativeTime(stats.lastPulse)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#637588] dark:text-[#9da8b9] mb-1">下次运行时间</p>
                <p className="text-sm font-medium text-[#111418] dark:text-white">
                  {formatTime(stats.nextRunAt)}
                </p>
                <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">
                  {stats.nextRunAt ? formatRelativeTime(stats.nextRunAt) : '未计划'}
                </p>
              </div>
            </div>
          </div>

          {/* 失败的市场列表 */}
          {stats.failedMarkets && stats.failedMarkets.length > 0 && (
            <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-[#637588] dark:text-[#9da8b9]">
                  同步失败的市场 ({stats.failedMarkets.length} 个)
                </h3>
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {stats.failedMarkets.map((market, index) => (
                  <div
                    key={market.marketId}
                    className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#111418] dark:text-white mb-1">
                          {market.marketTitle}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-[#637588] dark:text-[#9da8b9]">
                          <span>市场ID: {market.marketId.substring(0, 8)}...</span>
                          <span>External ID: {market.externalId || '未设置'}</span>
                        </div>
                      </div>
                      <a
                        href={`/admin/markets/edit/${market.marketId}?backTo=/admin/operations/odds`}
                        className="px-3 py-1 text-xs bg-primary text-white rounded hover:bg-blue-600 transition-colors whitespace-nowrap"
                      >
                        编辑
                      </a>
                    </div>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-2 break-words">
                      {market.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 实时日志展示 */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-[#637588] dark:text-[#9da8b9]">实时日志</h3>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-[#637588] dark:text-[#9da8b9]">实时更新中</span>
              </div>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {stats.recentLogs && stats.recentLogs.length > 0 ? (
                stats.recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-[#f3f4f6] dark:bg-[#1a1f2e] border border-[#e5e7eb] dark:border-[#283545]"
                  >
                    <div className="flex-shrink-0 w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-[#111418] dark:text-white">
                          {log.actionType}
                        </p>
                        <p className="text-xs text-[#637588] dark:text-[#9da8b9]">
                          {formatTime(log.timestamp)}
                        </p>
                      </div>
                      <p className="text-xs text-[#637588] dark:text-[#9da8b9] break-words">
                        {log.details || '无详细信息'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-[#637588] dark:text-[#9da8b9] text-sm">
                  暂无日志记录
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
