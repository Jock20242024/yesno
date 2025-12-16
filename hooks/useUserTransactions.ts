import { useState, useEffect } from 'react';
import { Deposit, Withdrawal } from '@/types/data';

interface UseUserTransactionsReturn {
  deposits: Deposit[];
  withdrawals: Withdrawal[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * 获取当前用户的交易记录（充值和提现）Hook
 */
export function useUserTransactions(): UseUserTransactionsReturn {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/transactions', {
        method: 'GET',
        credentials: 'include', // 重要：包含 Cookie
      });

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const result = await response.json();

      if (result.success && result.data) {
        setDeposits(result.data.deposits || []);
        setWithdrawals(result.data.withdrawals || []);
      } else {
        throw new Error(result.error || 'Invalid response format');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error fetching transactions';
      setError(errorMessage);
      console.error('Error fetching user transactions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  return {
    deposits,
    withdrawals,
    isLoading,
    error,
    refetch: fetchTransactions,
  };
}

