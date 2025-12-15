"use client";

interface MaxWinUser {
  rank: number;
  name: string;
  profit: number;
}

// Mock 数据 - 本月最大胜利 Top 7
const mockMaxWins: MaxWinUser[] = [
  { rank: 1, name: "CryptoTrader", profit: 125000 },
  { rank: 2, name: "MarketMaster", profit: 98000 },
  { rank: 3, name: "PredictPro", profit: 87500 },
  { rank: 4, name: "TradeKing", profit: 72000 },
  { rank: 5, name: "ForecastGuru", profit: 65000 },
  { rank: 6, name: "BetWizard", profit: 54000 },
  { rank: 7, name: "ProfitSeeker", profit: 48000 },
];

export default function MaxWinsSidebar() {
  const formatProfit = (profit: number) => {
    return `+$${profit.toLocaleString()}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-white text-lg font-bold">本月最大胜利</h2>
      <div className="flex flex-col gap-3">
        {mockMaxWins.map((user) => (
          <div
            key={user.rank}
            className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  user.rank === 1
                    ? "bg-pm-green/20 text-pm-green"
                    : "bg-zinc-700 text-zinc-300"
                }`}
              >
                {user.rank}
              </div>
              <span className="text-white text-sm font-medium">
                {user.name}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-pm-green text-sm font-bold">
                {formatProfit(user.profit)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

