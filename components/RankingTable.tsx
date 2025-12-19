"use client";

import { useState, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import Link from "next/link";
import { User } from "@/types/api";

interface RankingUser {
  rank: number;
  avatar: string;
  name: string;
  profit: number;
  volume: string;
}

const timeTabs = [
  { id: "today", label: "今天" },
  { id: "weekly", label: "每周" },
  { id: "monthly", label: "每月" },
  { id: "all", label: "全部" },
];

export default function RankingTable() {
  const [activeTab, setActiveTab] = useState("today");
  const [searchQuery, setSearchQuery] = useState("");
  const [rankingData, setRankingData] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 格式化利润/亏损
  const formatProfit = (profit: number) => {
    const sign = profit >= 0 ? "+" : "";
    return `${sign}$${profit.toLocaleString()}`;
  };

  // 格式化交易体量
  const formatVolume = (volume: number): string => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(1)}M`;
    } else if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(0)}K`;
    }
    return `$${volume.toLocaleString()}`;
  };

  // 获取排行榜数据
  const fetchRankings = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 构建查询参数
      const params = new URLSearchParams();
      if (activeTab !== "all") {
        params.append("timeRange", activeTab);
      }
      if (searchQuery) {
        params.append("search", searchQuery);
      }

      const response = await fetch(`/api/rankings?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch rankings");
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        setRankingData(result.data);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching data.");
      console.error("Error fetching rankings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 组件加载时获取数据
  useEffect(() => {
    fetchRankings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]); // 当时间筛选 Tab 改变时重新获取数据

  // 搜索时也重新获取数据（使用防抖优化）
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRankings();
    }, 300); // 300ms 防抖

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // 将 API 返回的 User 数据转换为组件使用的格式
  const filteredRankings: RankingUser[] = rankingData.map((user) => ({
    rank: user.rank,
    avatar: user.avatarUrl || "",
    name: user.username,
    profit: user.profitLoss,
    volume: formatVolume(user.volumeTraded),
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* 顶部导航 Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800">
        {timeTabs.map((tab) => (
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

      {/* 搜索栏 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="按名称搜索"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-pm-green transition-colors"
          />
        </div>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-pm-green mr-2" />
          <span className="text-zinc-400">Loading...</span>
        </div>
      )}

      {/* 错误状态 */}
      {error && !isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-red-500 font-medium mb-2">Error fetching data.</p>
            <p className="text-zinc-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* 排行榜表格 */}
      {!isLoading && !error && (
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  排名
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  用户
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  利润/亏损
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  体量
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredRankings.length > 0 ? (
                filteredRankings.map((user) => (
                  <tr
                    key={user.rank}
                    className="hover:bg-zinc-800/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <span
                          className={`text-sm font-bold ${
                            user.rank <= 3
                              ? user.rank === 1
                                ? "text-pm-green"
                                : "text-white"
                              : "text-zinc-400"
                          }`}
                        >
                          #{user.rank}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/rank/${user.name}`}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#D4AF37] flex-shrink-0 bg-pm-card" style={{ boxShadow: '0 0 8px rgba(212, 175, 55, 0.3)' }}>
                          <img
                            src="/logo.svg"
                            alt={user.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-white text-sm font-medium">
                          {user.name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`text-sm font-bold ${
                          user.profit >= 0 ? "text-pm-green" : "text-red-500"
                        }`}
                      >
                        {formatProfit(user.profit)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-medium text-zinc-300">
                        {user.volume}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-zinc-400">
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

