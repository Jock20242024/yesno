"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { signIn } from 'next-auth/react';

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. 最基础的清理
  const clearUserData = useCallback(() => {
    console.log("🧹 [AuthProvider] 执行清理...");
    
    // 🔥 清除所有用户相关的 localStorage
    localStorage.removeItem('pm_user');
    localStorage.removeItem('pm_currentUser');
    
    // 🔥 清除所有资金相关的 localStorage
    localStorage.removeItem('pm_store_balance');
    localStorage.removeItem('pm_store_positions');
    localStorage.removeItem('pm_store_history');
    localStorage.removeItem('pm_fundRecords');
    localStorage.removeItem('pm_deposits');
    localStorage.removeItem('pm_withdrawals');
    localStorage.removeItem('pm_frozenBalance');
    
    // 🔥 清除状态
    setIsLoggedIn(false);
    setUser(null);
    setIsLoading(false);
  }, []);

  // 2. 定义 logout (因为它被后面的函数引用)
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    clearUserData();
    // 🔥 修复：在执行跳转前先将 isLoading 设置为 false，切断死循环
    setIsLoading(false);
    // 注意：实际的跳转由 Navbar 中的 window.location.replace('/login') 处理
  }, [clearUserData]);

  // 3. 定义 handleApiGuestResponse (现在它能找到 logout 了)
  const handleApiGuestResponse = useCallback((response: Response, data?: any) => {
    if (response.status === 401 || data?.isGuest) {
      console.log("🔴 [AuthProvider] 身份过期，强制退出");
      logout();
      return true;
    }
    return false;
  }, [logout]);

  // 4. 状态刷新逻辑
  const refreshUserState = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      
      // 🔥 兼容 API 响应格式：{ success: true, user: {...} }
      if (data.success && data.user) {
        const userData = {
          id: data.user.id,
          email: data.user.email,
          ...data.user, // 保留其他字段（balance, isAdmin 等）
        };
        setIsLoggedIn(true);
        // 🔥 确保 user 对象包含 id 和 email（StoreContext 需要）
        setUser(userData);
        setIsLoading(false);
        return userData; // 🔥 返回最新的 user 对象，供外部调用使用
      } else {
        clearUserData();
        setIsLoading(false);
        return null;
      }
    } catch (e) {
      console.error('❌ [AuthProvider] refreshUserState error:', e);
      clearUserData();
      setIsLoading(false);
      return null;
    }
  }, [clearUserData]);

  const login = useCallback(async (credentials?: any) => {
    try {
      // 🔥 执行真正的 NextAuth 登录
      const result = await signIn('credentials', {
        ...credentials,
        redirect: false, // 防止页面被 NextAuth 强行刷新导致状态丢失
      });

      if (result?.error) throw new Error(result.error);

      // 登录成功后手动刷新状态
      await refreshUserState();
      
      // 🔥 获取最新的用户数据用于返回
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      const userData = data.success && data.user ? data.user : null;
      
      return { success: true, user: userData };
    } catch (error: any) {
      console.error("❌ [AuthProvider] Login failed:", error);
      return { success: false, error: error.message };
    }
  }, [refreshUserState]);

  useEffect(() => {
    refreshUserState();
  }, [refreshUserState]);

  // 这里的 currentUser 是为了兼容 LiveWallet 的依赖
  const currentUser = user;

  return (
    <AuthContext.Provider value={{ 
      isLoggedIn, 
      user, 
      currentUser, 
      isLoading, 
      login, 
      logout, 
      refreshUserState,
      handleApiGuestResponse 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
