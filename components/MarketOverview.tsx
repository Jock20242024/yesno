"use client";

import { Activity } from "lucide-react";
import { useState, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";

interface GlobalStat {
  id: string;
  label: string;
  value: number;
  unit: string | null;
  icon: string | null;
}

export default function MarketOverview() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<GlobalStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats', {
          cache: 'no-store',
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setStats(result.data);
          }
        }
      } catch (error) {
        console.error('获取统计数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
    // 每 60 秒自动刷新一次
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  // 格式化数值显示
  const formatValue = (value: number, unit: string | null): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    } else {
      return unit ? `${value.toLocaleString()} ${unit}` : value.toLocaleString();
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border-dark bg-surface-dark/50 backdrop-blur-sm shadow-xl">
      <div className="p-5">
        <h3 className="text-white text-sm font-bold mb-5 flex items-center gap-2 uppercase tracking-wider">
          <Activity className="w-4 h-4 text-primary animate-pulse" />
          {t('home.sidebar.title')}
        </h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-text-secondary text-sm">{t('home.sidebar.loading')}</div>
          </div>
        ) : stats.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-text-secondary text-sm">{t('home.sidebar.no_data')}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-0">
            {stats.map((stat, index) => (
              <div
                key={stat.id}
                className={`flex justify-between items-center py-4 ${
                  index < stats.length - 1 ? 'border-b border-border-dark/50' : ''
                }`}
              >
                <span className="text-text-secondary text-xs font-medium">{stat.label}</span>
                <span className={`font-mono font-bold text-sm ${
                  stat.label.includes('交易量') ? 'text-emerald-500 animate-pulse' : 'text-white'
                }`}>
                  {formatValue(stat.value, stat.unit)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

