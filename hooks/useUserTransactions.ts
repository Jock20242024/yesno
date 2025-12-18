import { useState, useEffect } from 'react';
import { Deposit, Withdrawal } from '@/types/data';
import { useAuth } from '@/components/providers/AuthProvider'; // ========== 修复：导入 useAuth ==========

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
  
  // ========== 修复：获取当前用户 ID，监听用户切换 ==========
  const { currentUser, isLoggedIn } = useAuth();

  const fetchTransactions = async () => {
    // ========== 修复：检查用户是否登录 ==========
    if (!isLoggedIn || !currentUser || !currentUser.id) {
      setDeposits([]);
      setWithdrawals([]);
      setIsLoading(false);
      return;
    }
    
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
      // ========== 修复：出错时清空数据 ==========
      setDeposits([]);
      setWithdrawals([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // ========== 修复：依赖 currentUser.id，用户切换时重新获取 ==========
    fetchTransactions();
  }, [currentUser?.id, isLoggedIn]); // 添加 currentUser.id 和 isLoggedIn 作为依赖

  return {
    deposits,
    withdrawals,
    isLoading,
    error,
    refetch: fetchTransactions,
  };
}

