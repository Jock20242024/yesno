"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { formatUSD } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";

interface ActivityItem {
  id: string;
  type: "Buy" | "Sell";
  market: string;
  marketId: string;
  amount: number;
  timestamp: string;
}

interface UserActivityTableProps {
  userId?: string;
}

export default function UserActivityTable({ userId }: UserActivityTableProps) {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState("activity");
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const tabs = [
    { id: "positions", label: t('profile.tabs.positions') },
    { id: "activity", label: t('profile.tabs.activity') },
  ];

  useEffect(() => {
    const fetchActivities = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/users/${userId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch user activities");
        }

        const result = await response.json();
        if (result.success && result.data && result.data.tradeHistory) {
          // 转换交易历史为活动列表
          const activitiesList = await Promise.all(
            result.data.tradeHistory.map(async (trade: any) => {
              // 获取市场标题
              let marketTitle = `Market ${trade.marketId}`;
              try {
                const marketResponse = await fetch(`/api/markets/${trade.marketId}`);
                if (marketResponse.ok) {
                  const marketResult = await marketResponse.json();
                  if (marketResult.success && marketResult.data) {
                    marketTitle = marketResult.data.title;
                  }
                }
              } catch (error) {
                console.error('Error fetching market title:', error);
              }

              // 格式化时间
              const timestamp = new Date(trade.timestamp);
              const now = new Date();
              const diffMs = now.getTime() - timestamp.getTime();
              const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
              const diffDays = Math.floor(diffHours / 24);
              
              let timeAgo = '';
              if (diffHours < 1) {
                timeAgo = language === 'en' ? 'Just now' : '刚刚';
              } else if (diffHours < 24) {
                timeAgo = language === 'en' ? `${diffHours} hours ago` : `${diffHours} 小时前`;
              } else if (diffDays < 7) {
                timeAgo = language === 'en' ? `${diffDays} days ago` : `${diffDays} 天前`;
              } else {
                timeAgo = timestamp.toLocaleDateString(language === 'en' ? 'en-US' : 'zh-CN');
              }

              return {
                id: trade.id,
                type: trade.type === 'buy' ? "Buy" as const : "Sell" as const,
                market: marketTitle,
                marketId: trade.marketId,
                amount: trade.amount || 0,
                timestamp: timeAgo,
              };
            })
          );

          setActivities(activitiesList);
        } else {
          throw new Error("Invalid response format");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error fetching activities.");
        console.error("Error fetching user activities:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivities();
  }, [userId]);

  return (
    <div className="flex flex-col gap-6">
      {/* 顶部 Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-bold transition-colors border-b-2 ${
              activeTab === tab.id
                ? "text-white border-pm-green"
                : "text-zinc-400 border-transparent hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 活动表格 */}
      {activeTab === "activity" && (
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
          <div className="w-full overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    {t('rank.table.type')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    {t('rank.table.market')}
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    {t('rank.table.value')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {isLoading && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-pm-green" />
                      <span className="text-zinc-400">{t('rank.loading')}</span>
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading && error && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-zinc-400">
                    {error}
                  </td>
                </tr>
              )}
              {!isLoading && !error && activities.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-zinc-400">
                    {t('profile.empty.activity')}
                  </td>
                </tr>
              )}
              {!isLoading && !error && activities.map((activity) => (
                <tr
                  key={activity.id}
                  className="hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <span
                      className={`text-sm font-bold ${
                        activity.type === "Buy"
                          ? "text-pm-green"
                          : "text-pm-red"
                      }`}
                    >
                      {activity.type === "Buy" ? t('market.trade.buy') : t('market.trade.sell')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/markets/${activity.marketId}`}
                      className="text-sm font-medium text-primary hover:text-primary-hover transition-colors"
                    >
                      {activity.market}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-medium text-white">
                      {formatUSD(activity.amount)}
                    </span>
                    <div className="text-xs text-zinc-500 mt-1">
                      {activity.timestamp}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Positions Tab 内容（占位） */}
      {activeTab === "positions" && (
        <div className="p-8 text-center text-zinc-400">
          <p>{t('rank.public.no_positions')}</p>
        </div>
      )}
    </div>
  );
}
