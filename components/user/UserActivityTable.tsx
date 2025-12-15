"use client";

import { useState } from "react";
import Link from "next/link";

interface ActivityItem {
  id: string;
  type: "Buy" | "Sell";
  market: string;
  marketId: number;
  amount: string;
  timestamp: string;
}

// Mock 数据
const mockActivities: ActivityItem[] = [
  {
    id: "1",
    type: "Buy",
    market: "Will Bitcoin reach $100k by end of 2024?",
    marketId: 1,
    amount: "$500.00",
    timestamp: "2 hours ago",
  },
  {
    id: "2",
    type: "Sell",
    market: "Will Trump win the 2024 election?",
    marketId: 2,
    amount: "$1,200.00",
    timestamp: "5 hours ago",
  },
  {
    id: "3",
    type: "Buy",
    market: "Will Apple stock hit $200 by Q2 2024?",
    marketId: 3,
    amount: "$300.00",
    timestamp: "1 day ago",
  },
  {
    id: "4",
    type: "Buy",
    market: "Will Ethereum reach $5k in 2024?",
    marketId: 4,
    amount: "$750.00",
    timestamp: "2 days ago",
  },
  {
    id: "5",
    type: "Sell",
    market: "Will the Lakers win the NBA championship?",
    marketId: 5,
    amount: "$450.00",
    timestamp: "3 days ago",
  },
];

const tabs = [
  { id: "positions", label: "Positions" },
  { id: "activity", label: "Activity" },
];

export default function UserActivityTable() {
  const [activeTab, setActiveTab] = useState("activity");

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
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  TYPE
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  MARKET
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  AMOUNT
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {mockActivities.map((activity) => (
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
                      {activity.type}
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
                      {activity.amount}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Positions Tab 内容（占位） */}
      {activeTab === "positions" && (
        <div className="p-8 text-center text-zinc-400">
          <p>No open positions</p>
        </div>
      )}
    </div>
  );
}

