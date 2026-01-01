"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface MaxWinUser {
  rank: number;
  name: string;
  profit: number;
}

export default function MaxWinsSidebar() {
  const { t } = useLanguage();
  const [maxWins, setMaxWins] = useState<MaxWinUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMaxWins = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/max-wins');
        if (!response.ok) {
          throw new Error('Failed to fetch max wins');
        }

        const result = await response.json();
        if (result.success && result.data) {
          setMaxWins(result.data);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching data.');
        console.error('Error fetching max wins:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMaxWins();
  }, []);

  const formatProfit = (profit: number) => {
    return `+$${profit.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-white text-lg font-bold">{t('rank.max_wins.title')}</h2>
      
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-pm-green" />
        </div>
      )}

      {error && !isLoading && (
        <div className="text-center py-8 text-zinc-400 text-sm">
          {error}
        </div>
      )}

      {!isLoading && !error && (
        <div className="flex flex-col gap-3">
          {maxWins.length > 0 ? (
            maxWins.map((user) => (
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
            ))
          ) : (
            <div className="text-center py-8 text-zinc-400 text-sm">
              {t('rank.max_wins.empty')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

