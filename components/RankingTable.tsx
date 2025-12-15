"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import Link from "next/link";

interface RankingUser {
  rank: number;
  avatar: string;
  name: string;
  profit: number;
  volume: string;
}

// Mock 数据
const mockRankings: RankingUser[] = [
  { rank: 1, avatar: "/images/avatar1.png", name: "CryptoTrader", profit: 125000, volume: "$2.4M" },
  { rank: 2, avatar: "/images/avatar2.png", name: "MarketMaster", profit: 98000, volume: "$1.8M" },
  { rank: 3, avatar: "/images/avatar3.png", name: "PredictPro", profit: 87500, volume: "$1.5M" },
  { rank: 4, avatar: "/images/avatar4.png", name: "TradeKing", profit: 72000, volume: "$1.2M" },
  { rank: 5, avatar: "/images/avatar5.png", name: "ForecastGuru", profit: 65000, volume: "$980K" },
  { rank: 6, avatar: "/images/avatar6.png", name: "BetWizard", profit: 54000, volume: "$850K" },
  { rank: 7, avatar: "/images/avatar7.png", name: "ProfitSeeker", profit: 48000, volume: "$720K" },
  { rank: 8, avatar: "/images/avatar8.png", name: "MarketWhiz", profit: 42000, volume: "$650K" },
  { rank: 9, avatar: "/images/avatar9.png", name: "TradeExpert", profit: 38000, volume: "$580K" },
  { rank: 10, avatar: "/images/avatar10.png", name: "PredictorPro", profit: 35000, volume: "$520K" },
];

const timeTabs = [
  { id: "today", label: "今天" },
  { id: "weekly", label: "每周" },
  { id: "monthly", label: "每月" },
  { id: "all", label: "全部" },
];

export default function RankingTable() {
  const [activeTab, setActiveTab] = useState("today");
  const [searchQuery, setSearchQuery] = useState("");

  const formatProfit = (profit: number) => {
    const sign = profit >= 0 ? "+" : "";
    return `${sign}$${profit.toLocaleString()}`;
  };

  const filteredRankings = mockRankings.filter((user) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

      {/* 排行榜表格 */}
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
            {filteredRankings.map((user) => (
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
                    <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center overflow-hidden">
                      <span className="text-white text-sm font-bold">
                        {user.name.charAt(0)}
                      </span>
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

