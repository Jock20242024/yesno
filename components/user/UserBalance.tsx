"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

interface UserBalanceProps {
  className?: string;
  showLabel?: boolean;
}

/**
 * 实时余额显示组件
 * 定期从 API 获取最新余额，确保与数据库同步
 */
export default function UserBalance({ className = "", showLabel = false }: UserBalanceProps) {
  const { isLoggedIn, currentUser, refreshUserState } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 获取实时余额（使用 useCallback 稳定引用）
  const fetchBalance = useCallback(async () => {
    if (!isLoggedIn) {
      setBalance(null);
      return;
    }

    setIsRefreshing(true);
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store", // 禁用缓存，确保获取最新数据
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user?.balance !== undefined) {
          const balanceNum = Number(data.user.balance);
          if (!isNaN(balanceNum)) {
            setBalance(balanceNum);
            // 同时更新 AuthContext 中的余额（使用 refreshUserState，但不作为依赖项）
            // 使用 setTimeout 避免在渲染期间调用
            setTimeout(() => {
              refreshUserState();
            }, 0);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch balance:", error);
      // 发生错误时使用 currentUser 的余额作为后备
      if (currentUser?.balance !== undefined) {
        setBalance(Number(currentUser.balance));
      }
    } finally {
      setIsRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]); // 只依赖 isLoggedIn，避免循环

  // 初始化时获取余额
  useEffect(() => {
    if (isLoggedIn) {
      fetchBalance();
    } else {
      setBalance(null);
    }
  }, [isLoggedIn, fetchBalance]);

  // 定期刷新余额（每30秒）
  useEffect(() => {
    if (!isLoggedIn) return;

    const interval = setInterval(() => {
      fetchBalance();
    }, 30000); // 30秒刷新一次

    return () => clearInterval(interval);
  }, [isLoggedIn, fetchBalance]);

  // 监听页面可见性，当页面重新可见时刷新余额
  useEffect(() => {
    if (!isLoggedIn) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchBalance();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isLoggedIn, fetchBalance]);

  // 监听全局余额刷新事件（由资金变动操作触发）
  useEffect(() => {
    if (!isLoggedIn) return;

    const handleBalanceRefresh = () => {
      fetchBalance();
    };

    // 监听自定义事件
    window.addEventListener("balance-updated", handleBalanceRefresh);
    
    return () => {
      window.removeEventListener("balance-updated", handleBalanceRefresh);
    };
  }, [isLoggedIn, fetchBalance]);

  // 格式化余额显示
  const formatBalance = (amount: number | null): string => {
    if (amount === null || amount === undefined) {
      return "$0.00";
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // 确定显示的余额值：优先使用实时获取的值，否则使用 currentUser 的值
  const displayBalance = balance !== null ? balance : (currentUser?.balance ? Number(currentUser.balance) : 0);

  if (!isLoggedIn) {
    return null;
  }

  return (
    <span className={className}>
      {showLabel && (
        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider leading-none mb-1 block">总资产</span>
      )}
      <span className={`text-sm font-black text-white leading-none font-mono tracking-tight ${isRefreshing ? "opacity-70" : ""}`}>
        {formatBalance(displayBalance)}
      </span>
    </span>
  );
}
