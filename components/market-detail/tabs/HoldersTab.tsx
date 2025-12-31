"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Holder {
  rank: number;
  userId: string;
  username: string;
  email: string;
  shares: number;
  profit: number;
  outcome: "YES" | "NO";
  avgPrice: number;
}

interface HoldersTabProps {
  marketId?: string;
}

export default function HoldersTab({ marketId }: HoldersTabProps) {
  const [holders, setHolders] = useState<Holder[]>([]);
  const [stats, setStats] = useState({
    totalHolders: 0,
    yesHolders: 0,
    noHolders: 0,
    yesPercentage: 0,
    noPercentage: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!marketId) {
      setIsLoading(false);
      return;
    }

    const fetchHolders = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/markets/${marketId}/holders`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch holders');
        }

        const result = await response.json();

        if (result.success && result.data) {
          setHolders(result.data.holders);
          setStats(result.data.stats);
        } else {
          throw new Error(result.error || 'Invalid response format');
        }
      } catch (err) {
        console.error('Failed to fetch holders:', err);
        setError(err instanceof Error ? err.message : 'Failed to load holders');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHolders();
  }, [marketId]);

  const formatProfit = (profit: number) => {
    const sign = profit >= 0 ? "+" : "";
    return `${sign}$${Math.abs(profit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-pm-text-dim border-t-primary rounded-full animate-spin"></div>
          <span className="text-sm text-pm-text-dim">Loading holders...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-pm-red">{error}</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-hidden flex flex-col gap-6">
      {/* 顶部摘要 */}
      <div className="p-6 bg-pm-card border border-pm-border rounded-xl">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-pm-text-dim uppercase tracking-wider">
              Total Holders
            </span>
            <span className="text-2xl font-bold text-white">{stats.totalHolders}</span>
          </div>
          {stats.totalHolders > 0 && (
            <>
              <div className="flex gap-2 h-3 bg-pm-card-hover rounded-full overflow-hidden">
                <div
                  className="bg-pm-green"
                  style={{ width: `${stats.yesPercentage}%` }}
                />
                <div
                  className="bg-pm-red"
                  style={{ width: `${stats.noPercentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-pm-green" />
                  <span className="text-pm-text-dim">YES: {stats.yesHolders}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-pm-red" />
                  <span className="text-pm-text-dim">NO: {stats.noHolders}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 持有者表格 */}
      {holders.length === 0 ? (
        <div className="text-pm-text-dim text-center py-12">
          No holder data available
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-pm-border bg-pm-card">
          <div className="w-full overflow-x-auto">
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
              {holders.map((holder) => (
                <tr
                  key={holder.userId}
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
                        {holder.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white text-sm font-medium">
                        {holder.username}
                      </span>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-medium text-white font-mono">
                      {holder.shares.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
      )}
    </div>
  );
}

