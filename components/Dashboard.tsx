"use client";

import { useState, useEffect } from "react";
import { Bitcoin, Building2, Trophy, DollarSign, Cpu, LucideIcon } from "lucide-react";
import { BarChart3, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { Market } from "@/types/api";

/**
 * Dashboard 组件 - 完全从 API 获取数据
 * 
 * 🔥 核心修复：移除了 MARKET_DATA Mock 数据
 * 现在完全从 API 获取市场列表，确保显示最新内容
 */

const iconMap: Record<string, LucideIcon> = {
  Bitcoin,
  Building2,
  Trophy,
  DollarSign,
  Cpu,
};

/**
 * 市场列表子组件 - 从 API 获取数据
 */
function DashboardMarketsList() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/markets?page=1&pageSize=20&status=OPEN', {
          cache: 'no-store',
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch markets');
        }

        const result = await response.json();
        
        if (result.success && result.data) {
          setMarkets(result.data.slice(0, 20)); // 只取前20个
        }
      } catch (error) {
        console.error('Error fetching markets:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMarkets();
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="h-32 bg-gray-100/10 animate-pulse rounded-lg border border-gray-800"
            />
          ))}
        </div>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="p-4 md:p-6 flex flex-col gap-6">
        <div className="text-center text-text-secondary py-8">
          暂无市场数据
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {markets.map((market) => {
          const Icon = iconMap[market.icon || 'Bitcoin'] || Bitcoin;
          const yesPercent = market.yesPercent ?? 50;
          const noPercent = market.noPercent ?? 50;

          return (
            <Link
              key={market.id}
              href={`/markets/${market.id}`}
              className="flex flex-col p-4 rounded-lg border border-border-dark bg-surface-dark hover:border-primary/40 transition-all cursor-pointer group relative overflow-hidden h-full"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5 text-primary" />
                  <span className="text-xs text-text-secondary uppercase tracking-wider">
                    {market.category || '未分类'}
                  </span>
                </div>
              </div>

              <h3 className="text-white font-semibold text-sm mb-3 line-clamp-2 group-hover:text-primary transition-colors">
                {market.titleZh || market.title}
              </h3>

              <div className="mt-auto">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-green-400 font-medium">YES {yesPercent}%</span>
                  <span className="text-red-400 font-medium">NO {noPercent}%</span>
                </div>
                <div className="h-1.5 bg-pm-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-pm-green"
                    style={{ width: `${yesPercent}%` }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { isLoggedIn, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      router.replace("/login");
    }
  }, [isLoggedIn, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">加载中...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">仪表盘</h1>
          <p className="text-text-secondary">查看您的预测和市场动态</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-surface-dark rounded-lg border border-border-dark p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm mb-1">总持仓</p>
                <p className="text-2xl font-bold">$0</p>
              </div>
              <BarChart3 className="w-8 h-8 text-primary" />
            </div>
          </div>

          <div className="bg-surface-dark rounded-lg border border-border-dark p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm mb-1">总收益</p>
                <p className="text-2xl font-bold text-green-400">$0</p>
              </div>
              <Trophy className="w-8 h-8 text-primary" />
            </div>
          </div>

          <div className="bg-surface-dark rounded-lg border border-border-dark p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-sm mb-1">活跃预测</p>
                <p className="text-2xl font-bold">0</p>
              </div>
              <MessageCircle className="w-8 h-8 text-primary" />
            </div>
          </div>
        </div>

        <div className="bg-surface-dark rounded-lg border border-border-dark">
          <div className="p-4 border-b border-border-dark">
            <h2 className="text-xl font-bold">热门市场</h2>
          </div>
          <DashboardMarketsList />
        </div>
      </div>
    </div>
  );
}
