import { useState, useEffect } from 'react';
import { Order } from '@/types/data';

interface UseUserOrdersReturn {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * 获取当前用户的订单列表 Hook
 */
export function useUserOrders(): UseUserOrdersReturn {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/orders/user', {
        method: 'GET',
        credentials: 'include', // 重要：包含 Cookie
      });

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const result = await response.json();

      if (result.success && result.data) {
        setOrders(result.data);
      } else {
        throw new Error(result.error || 'Invalid response format');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error fetching orders';
      setError(errorMessage);
      console.error('Error fetching user orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return {
    orders,
    isLoading,
    error,
    refetch: fetchOrders,
  };
}

