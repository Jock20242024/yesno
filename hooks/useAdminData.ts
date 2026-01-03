"use client";

import { useState, useEffect } from "react";
import { Market } from "@/types/api";

// 注意：Admin Token 存储在 HttpOnly Cookie 中，浏览器会自动发送
// 不需要在 Authorization header 中手动传递

// 充值订单数据类型
export interface Deposit {
  orderId: string;
  userId: string;
  username: string;
  amount: number;
  status: string;
  timestamp: string;
  paymentMethod?: string;
}

// 提现请求数据类型
export interface Withdrawal {
  orderId: string;
  userId: string;
  username: string;
  amount: number;
  targetAddress: string;
  status: string;
  timestamp: string;
  network?: string;
  rejectReason?: string;
  txHash?: string;
}

// 操作日志数据类型
export interface AdminLog {
  logId: string;
  adminId: string;
  adminUsername: string;
  actionType: string;
  timestamp: string;
  details: string;
  relatedObjectId?: string;
  relatedObjectType?: string;
}

// 分页信息类型
interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// API 响应类型
interface ApiResponse<T> {
  success: boolean;
  data: T[];
  pagination: Pagination;
  error?: string;
}

// useDeposits Hook
export function useDeposits(queryParams?: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    const fetchDeposits = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        // 🔥 参数验证：确保参数不为空字符串
        if (queryParams?.search && queryParams.search.trim() !== '') {
          params.append("search", queryParams.search);
        }
        if (queryParams?.status && queryParams.status.trim() !== '') {
          params.append("status", queryParams.status);
        }
        if (queryParams?.page && queryParams.page > 0) {
          params.append("page", queryParams.page.toString());
        }
        if (queryParams?.limit && queryParams.limit > 0) {
          params.append("limit", queryParams.limit.toString());
        }

        const response = await fetch(`/api/admin/deposits?${params.toString()}`, {
          method: "GET",
          headers: {
            // Cookie 会被浏览器自动发送（HttpOnly Cookie）
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("获取充值列表失败");
        }

        const data: ApiResponse<Deposit> = await response.json();

        if (data.success) {
          setDeposits(data.data);
          setPagination(data.pagination);
        } else {
          throw new Error(data.error || "获取充值列表失败");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "获取充值列表失败");
        setDeposits([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDeposits();
  }, [queryParams?.search, queryParams?.status, queryParams?.page, queryParams?.limit]);

  return { deposits, isLoading, error, pagination };
}

// useWithdrawals Hook
export function useWithdrawals(queryParams?: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    const fetchWithdrawals = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        // 🔥 参数验证：确保参数不为空字符串
        if (queryParams?.search && queryParams.search.trim() !== '') {
          params.append("search", queryParams.search);
        }
        if (queryParams?.status && queryParams.status.trim() !== '') {
          params.append("status", queryParams.status);
        }
        if (queryParams?.page && queryParams.page > 0) {
          params.append("page", queryParams.page.toString());
        }
        if (queryParams?.limit && queryParams.limit > 0) {
          params.append("limit", queryParams.limit.toString());
        }

        const response = await fetch(`/api/admin/withdrawals?${params.toString()}`, {
          method: "GET",
          headers: {
            // Cookie 会被浏览器自动发送（HttpOnly Cookie）
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("获取提现列表失败");
        }

        const data: ApiResponse<Withdrawal> = await response.json();

        if (data.success) {
          setWithdrawals(data.data);
          // 安全渲染：确保 pagination 对象存在且包含必需的属性
          setPagination(data.pagination || {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
          });
        } else {
          throw new Error(data.error || "获取提现列表失败");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "获取提现列表失败");
        setWithdrawals([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWithdrawals();
  }, [queryParams?.search, queryParams?.status, queryParams?.page, queryParams?.limit]);

  return { withdrawals, isLoading, error, pagination };
}

// useAdminLogs Hook
export function useAdminLogs(queryParams?: {
  search?: string;
  adminId?: string;
  actionType?: string;
  page?: number;
  limit?: number;
}) {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (queryParams?.search) params.append("search", queryParams.search);
        if (queryParams?.adminId) params.append("adminId", queryParams.adminId);
        if (queryParams?.actionType) params.append("actionType", queryParams.actionType);
        if (queryParams?.page) params.append("page", queryParams.page.toString());
        if (queryParams?.limit) params.append("limit", queryParams.limit.toString());

        const response = await fetch(`/api/admin/logs?${params.toString()}`, {
          method: "GET",
          headers: {
            // Cookie 会被浏览器自动发送（HttpOnly Cookie）
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("获取操作日志失败");
        }

        const data: ApiResponse<AdminLog> = await response.json();

        if (data.success) {
          setLogs(data.data);
          setPagination(data.pagination);
        } else {
          throw new Error(data.error || "获取操作日志失败");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "获取操作日志失败");
        setLogs([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [queryParams?.search, queryParams?.adminId, queryParams?.actionType, queryParams?.page, queryParams?.limit]);

  return { logs, isLoading, error, pagination };
}

// useMarketDetail Hook
export function useMarketDetail(marketId: string | null) {
  const [market, setMarket] = useState<Market | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!marketId) {
      setIsLoading(false);
      return;
    }

    const fetchMarket = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/markets/${marketId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("市场不存在");
          }
          throw new Error("获取市场详情失败");
        }

        const data = await response.json();

        if (data.success && data.data) {
          setMarket(data.data);
        } else {
          throw new Error(data.error || "获取市场详情失败");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "获取市场详情失败");
        setMarket(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMarket();
  }, [marketId]);

  return { market, isLoading, error };
}

// 财务汇总数据类型
export interface FinanceSummary {
  totalDeposits: number;
  totalWithdrawals: number;
  netFlow: number;
  feesCollected: number;
  trendData: Array<{
    month: string;
    deposits: number;
    withdrawals: number;
    netFlow: number;
  }>;
}

// useFinanceSummary Hook
export function useFinanceSummary(queryParams?: {
  startDate?: string;
  endDate?: string;
}) {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFinanceSummary = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (queryParams?.startDate) params.append("startDate", queryParams.startDate);
        if (queryParams?.endDate) params.append("endDate", queryParams.endDate);

        const response = await fetch(`/api/admin/finance/summary?${params.toString()}`, {
          method: "GET",
          headers: {
            // Cookie 会被浏览器自动发送（HttpOnly Cookie）
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("获取财务汇总数据失败");
        }

        const data = await response.json();

        if (data.success && data.data) {
          setSummary(data.data);
        } else {
          throw new Error(data.error || "获取财务汇总数据失败");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "获取财务汇总数据失败");
        setSummary(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFinanceSummary();
  }, [queryParams?.startDate, queryParams?.endDate]);

  return { summary, isLoading, error };
}

// useAdminMarkets Hook
/**
 * 获取待处理的提现请求 Hook
 */
export function usePendingWithdrawals() {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPendingWithdrawals = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/admin/withdrawals', {
          method: 'GET',
          headers: {
            // Cookie 会被浏览器自动发送（HttpOnly Cookie）
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch pending withdrawals');
        }

        const result = await response.json();

        if (result.success && result.data) {
          setWithdrawals(result.data);
        } else {
          throw new Error(result.error || 'Invalid response format');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error fetching pending withdrawals';
        setError(errorMessage);
        console.error('Error fetching pending withdrawals:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPendingWithdrawals();
  }, []);

  return { withdrawals, isLoading, error };
}

export function useAdminMarkets(queryParams?: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
  showDetails?: boolean; // 🔥 下钻功能：是否显示详细场次
  source?: string; // 🚀 第一步：添加 source 参数（factory 或 manual）
}) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    const fetchMarkets = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        // 🔥 参数验证：确保参数不为空字符串
        if (queryParams?.search && queryParams.search.trim() !== '') {
          params.append("search", queryParams.search);
        }
        if (queryParams?.status && queryParams.status.trim() !== '') {
          params.append("status", queryParams.status);
        }
        if (queryParams?.page && queryParams.page > 0) {
          params.append("page", queryParams.page.toString());
        }
        if (queryParams?.limit && queryParams.limit > 0) {
          params.append("limit", queryParams.limit.toString());
        }
        if (queryParams?.showDetails) {
          params.append("showDetails", "true"); // 🔥 下钻功能
        }
        // 🔥 参数验证：确保 source 不为空字符串
        if (queryParams?.source && queryParams.source.trim() !== '') {
          params.append("source", queryParams.source); // 🚀 第一步：添加 source 参数
        }

        const response = await fetch(`/api/admin/markets?${params.toString()}`, {
          method: "GET",
          headers: {
            // Cookie 会被浏览器自动发送（HttpOnly Cookie）
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("获取市场列表失败");
        }

        const data: ApiResponse<Market> = await response.json();

        if (data.success) {
          setMarkets(data.data);
          setPagination(data.pagination);
        } else {
          throw new Error(data.error || "获取市场列表失败");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "获取市场列表失败");
        setMarkets([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMarkets();
    
    // 🚀 自动刷新：每30秒刷新一次数据（特别是工厂市场，状态会随时间变化）
    // 这样"已结束"数量会随着时间推移自动增加
    const intervalId = setInterval(() => {
      fetchMarkets();
    }, 30000); // 30秒刷新一次

    return () => {
      clearInterval(intervalId);
    };
  }, [queryParams?.search, queryParams?.status, queryParams?.page, queryParams?.limit, queryParams?.showDetails, queryParams?.source]);

  return { markets, isLoading, error, pagination };
}

// 用户数据类型
export interface AdminUser {
  id: string;
  email: string; // ✅ 修复：添加 email 字段（API 实际返回 User 类型包含 email）
  username?: string; // 可选字段，向后兼容
  balance: number;
  isAdmin: boolean;
  isBanned: boolean;
  createdAt: string;
}

// useAdminUsers Hook
export function useAdminUsers(queryParams?: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        // 🔥 参数验证：确保参数不为空字符串
        if (queryParams?.search && queryParams.search.trim() !== '') {
          params.append("search", queryParams.search);
        }
        if (queryParams?.status && queryParams.status.trim() !== '') {
          params.append("status", queryParams.status);
        }
        if (queryParams?.page && queryParams.page > 0) {
          params.append("page", queryParams.page.toString());
        }
        if (queryParams?.limit && queryParams.limit > 0) {
          params.append("limit", queryParams.limit.toString());
        }

        const response = await fetch(`/api/admin/users?${params.toString()}`, {
          method: "GET",
          headers: {
            // Cookie 会被浏览器自动发送（HttpOnly Cookie）
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("获取用户列表失败");
        }

        const data: ApiResponse<AdminUser> = await response.json();

        if (data.success) {
          setUsers(data.data);
          setPagination(data.pagination);
        } else {
          throw new Error(data.error || "获取用户列表失败");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "获取用户列表失败");
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [queryParams?.search, queryParams?.status, queryParams?.page, queryParams?.limit]);

  const refetch = () => {
    const params = new URLSearchParams();
    if (queryParams?.search) params.append("search", queryParams.search);
    if (queryParams?.status) params.append("status", queryParams.status);
    if (queryParams?.page) params.append("page", queryParams.page.toString());
    if (queryParams?.limit) params.append("limit", queryParams.limit.toString());

    fetch(`/api/admin/users?${params.toString()}`, {
      method: "GET",
      headers: {
        // Cookie 会被浏览器自动发送（HttpOnly Cookie）
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        if (!response.ok) throw new Error("获取用户列表失败");
        return response.json();
      })
      .then((data: ApiResponse<AdminUser>) => {
        if (data.success) {
          setUsers(data.data);
          setPagination(data.pagination);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "获取用户列表失败");
      });
  };

  return { users, isLoading, error, pagination, refetch };
}

