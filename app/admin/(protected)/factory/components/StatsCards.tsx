"use client";

import { Activity, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface FactoryStats {
  activeTemplates: number;
  todayGenerated: number;
  pausedTemplates: number;
  totalTemplates: number;
  lastFactoryRunAt?: string | null; // 🔥 最后工厂运行时间（心跳）
}

interface MarketTemplate {
  id: string;
  name: string;
  healthStatus?: 'HEALTHY' | 'GAP'; // 🚀 第二步：添加健康度状态
}

interface StatsCardsProps {
  stats: FactoryStats | null;
  isLoadingStats: boolean;
  templates?: MarketTemplate[]; // 🚀 第二步：传入模板列表以计算断粮数量
}

export default function StatsCards({ stats, isLoadingStats, templates = [] }: StatsCardsProps) {
  // 🚀 优化：计算库存预警数量（基于未来储备）
  const gapTemplates = templates.filter(t => t.healthStatus === 'GAP');
  const gapCount = gapTemplates.length;
  const gapTemplateNames = gapTemplates.map(t => t.name).slice(0, 3); // 最多显示3个

  // 🔥 计算心跳状态
  const [heartbeatStatus, setHeartbeatStatus] = useState<{
    isHealthy: boolean;
    minutesAgo: number | null;
    statusText: string;
  }>({ isHealthy: false, minutesAgo: null, statusText: '等待数据...' });

  useEffect(() => {
    if (!stats?.lastFactoryRunAt) {
      setHeartbeatStatus({
        isHealthy: false,
        minutesAgo: null,
        statusText: '暂无记录',
      });
      return;
    }

    const calculateHeartbeat = () => {
      const lastRun = new Date(stats.lastFactoryRunAt!);
      const now = new Date();
      const diffMs = now.getTime() - lastRun.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      if (diffMinutes < 20) {
        setHeartbeatStatus({
          isHealthy: true,
          minutesAgo: diffMinutes,
          statusText: '自动化巡航中',
        });
      } else {
        setHeartbeatStatus({
          isHealthy: false,
          minutesAgo: diffMinutes,
          statusText: `巡航中断 (上次: ${diffMinutes}分钟前)`,
        });
      }
    };

    calculateHeartbeat();
    // 每30秒更新一次心跳状态
    const interval = setInterval(calculateHeartbeat, 30000);
    return () => clearInterval(interval);
  }, [stats?.lastFactoryRunAt]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* 🔥 自动化工厂心跳监测 */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[#637588] dark:text-[#9da8b9]">自动化工厂心跳监测</h3>
          <div className={`w-3 h-3 rounded-full ${heartbeatStatus.isHealthy ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-2xl ${heartbeatStatus.isHealthy ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {heartbeatStatus.isHealthy ? '🟢' : '🔴'}
          </span>
          <p className={`text-sm font-medium ${heartbeatStatus.isHealthy ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {isLoadingStats ? '...' : heartbeatStatus.statusText}
          </p>
        </div>
        {heartbeatStatus.minutesAgo !== null && heartbeatStatus.isHealthy && (
          <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-2">
            上次运行: {heartbeatStatus.minutesAgo} 分钟前
          </p>
        )}
      </div>

      {/* 🚀 优化：库存预警（检查未来储备，而非当前这一秒） */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[#637588] dark:text-[#9da8b9]">库存预警</h3>
          <AlertCircle className={`w-5 h-5 ${gapCount > 0 ? 'text-red-500' : 'text-green-500'}`} />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <p className={`text-2xl font-bold ${gapCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {isLoadingStats ? '...' : gapCount}
            </p>
            <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">
              {gapCount === 0 ? '库存充足' : '个模版缺货'}
            </p>
          </div>
          {/* 🚀 优化：显示缺货的模板名称 */}
          {gapCount > 0 && gapTemplateNames.length > 0 && (
            <div className="mt-2 pt-2 border-t border-[#e5e7eb] dark:border-[#283545]">
              <p className="text-xs text-[#637588] dark:text-[#9da8b9] mb-1">缺货模版：</p>
              <div className="flex flex-wrap gap-1">
                {gapTemplateNames.map((name, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 rounded">
                    {name}
                  </span>
                ))}
                {gapCount > 3 && (
                  <span className="text-xs px-2 py-0.5 text-[#637588] dark:text-[#9da8b9]">
                    +{gapCount - 3} 个
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
