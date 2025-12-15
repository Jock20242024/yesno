"use client";

import Link from "next/link";

interface Holder {
  rank: number;
  userId: string;
  userName: string;
  shares: number;
  profit: number;
  outcome: "YES" | "NO";
}

// Mock 持有者数据
const mockHolders: Holder[] = [
  { rank: 1, userId: "user1", userName: "CryptoTrader", shares: 12500, profit: 12500, outcome: "YES" },
  { rank: 2, userId: "user2", userName: "MarketMaster", shares: 9800, profit: 9800, outcome: "YES" },
  { rank: 3, userId: "user3", userName: "PredictPro", shares: 8750, profit: 8750, outcome: "YES" },
  { rank: 4, userId: "user4", userName: "TradeKing", shares: 7200, profit: -3600, outcome: "NO" },
  { rank: 5, userId: "user5", userName: "ForecastGuru", shares: 6500, profit: 6500, outcome: "YES" },
  { rank: 6, userId: "user6", userName: "BetWizard", shares: 5400, profit: -2700, outcome: "NO" },
  { rank: 7, userId: "user7", userName: "ProfitSeeker", shares: 4800, profit: 4800, outcome: "YES" },
  { rank: 8, userId: "user8", userName: "MarketWhiz", shares: 4200, profit: -2100, outcome: "NO" },
];

export default function HoldersTab() {
  const totalHolders = mockHolders.length;
  const yesHolders = mockHolders.filter((h) => h.outcome === "YES").length;
  const noHolders = mockHolders.filter((h) => h.outcome === "NO").length;
  const yesPercentage = Math.round((yesHolders / totalHolders) * 100);
  const noPercentage = Math.round((noHolders / totalHolders) * 100);

  const formatProfit = (profit: number) => {
    const sign = profit >= 0 ? "+" : "";
    return `${sign}$${Math.abs(profit).toLocaleString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 顶部摘要 */}
      <div className="p-6 bg-pm-card border border-pm-border rounded-xl">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-pm-text-dim uppercase tracking-wider">
              总持有者
            </span>
            <span className="text-2xl font-bold text-white">{totalHolders}</span>
          </div>
          <div className="flex gap-2 h-3 bg-pm-card-hover rounded-full overflow-hidden">
            <div
              className="bg-pm-green"
              style={{ width: `${yesPercentage}%` }}
            />
            <div
              className="bg-pm-red"
              style={{ width: `${noPercentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-pm-green" />
              <span className="text-pm-text-dim">YES: {yesHolders}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-pm-red" />
              <span className="text-pm-text-dim">NO: {noHolders}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 持有者表格 */}
      <div className="overflow-hidden rounded-xl border border-pm-border bg-pm-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-pm-border">
              <th className="px-6 py-4 text-left text-xs font-bold text-pm-text-dim uppercase tracking-wider">
                RANK
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-pm-text-dim uppercase tracking-wider">
                USER
              </th>
              <th className="px-6 py-4 text-right text-xs font-bold text-pm-text-dim uppercase tracking-wider">
                SHARES
              </th>
              <th className="px-6 py-4 text-right text-xs font-bold text-pm-text-dim uppercase tracking-wider">
                PROFIT
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pm-border">
            {mockHolders.map((holder) => (
              <tr
                key={holder.rank}
                className="hover:bg-pm-card-hover transition-colors"
              >
                <td className="px-6 py-4">
                  <span
                    className={`text-sm font-bold ${
                      holder.rank <= 3
                        ? holder.rank === 1
                          ? "text-pm-green"
                          : "text-white"
                        : "text-pm-text-dim"
                    }`}
                  >
                    #{holder.rank}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <Link
                    href={`/rank/${holder.userId}`}
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pm-green via-primary to-pm-blue flex items-center justify-center text-white text-xs font-bold">
                      {holder.userName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-white text-sm font-medium">
                      {holder.userName}
                    </span>
                  </Link>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm font-medium text-white font-mono">
                    {holder.shares.toLocaleString()}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span
                    className={`text-sm font-bold ${
                      holder.profit >= 0 ? "text-pm-green" : "text-pm-red"
                    }`}
                  >
                    {formatProfit(holder.profit)}
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

