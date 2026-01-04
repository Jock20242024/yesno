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
    // 🔥 修复：保存语言设置（在清除前）
    const savedLanguage = typeof window !== 'undefined' ? localStorage.getItem('language') : null;

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
    
    // 🔥 清除所有 SWR 缓存键
    if (typeof window !== 'undefined') {
      const cacheKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('swr-') || 
        key.startsWith('$swr$')
      );
      cacheKeys.forEach(key => localStorage.removeItem(key));
    }
    
    // 🔥 恢复语言设置
    if (savedLanguage && typeof window !== 'undefined') {
      localStorage.setItem('language', savedLanguage);
    }
    
    // 🔥 清除状态
    setIsLoggedIn(false);
    setUser(null);
    setIsLoading(false);
  }, []);

  // 2. 定义 logout (因为它被后面的函数引用)
  const logout = useCallback(async () => {
    try {
      // 🔥 调用登出 API
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('❌ [AuthProvider] Logout API error:', e);
    }
    
    // 🔥 清除所有用户数据
    clearUserData();
    
    // 🔥 清除所有 SWR 缓存
    if (typeof window !== 'undefined') {
      // 清除 SWR 全局缓存
      if ((window as any).__SWR_CACHE__) {
        (window as any).__SWR_CACHE__.clear();
      }
      
      // 清除所有可能的缓存键
      const cacheKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('swr-') || 
        key.startsWith('pm_') ||
        key.startsWith('$swr$')
      );
      cacheKeys.forEach(key => localStorage.removeItem(key));
    }
    
    // 🔥 修复：在执行跳转前先将 isLoading 设置为 false，切断死循环
    setIsLoading(false);
    // 注意：实际的跳转由 Navbar 中的 window.location.replace('/') 处理
  }, [clearUserData]);

  // 3. 定义 handleApiGuestResponse (现在它能找到 logout 了)
  const handleApiGuestResponse = useCallback((response: Response, data?: any) => {
    if (response.status === 401 || data?.isGuest) {

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
      console.log('🔍 [AuthProvider] 开始登录，邮箱:', credentials?.email);
      
      // 🔥 修复：先调用自定义登录 API（/api/auth/login），而不是直接使用 NextAuth
      // 这样可以获得更详细的错误信息
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });

      const loginData = await loginResponse.json();
      
      if (!loginResponse.ok || !loginData.success) {
        console.error('❌ [AuthProvider] 登录 API 失败:', loginData);
        // 🔥 修复：返回详细的错误信息，优先使用 message 字段
        const errorMessage = loginData.message || loginData.error || 'Login failed';
        return { 
          success: false, 
          error: errorMessage,
          details: loginData.details,
        };
      }

      // 🔥 性能优化：移除 NextAuth signIn 调用，因为我们已经在 /api/auth/login 中设置了 cookie
      // 直接使用 /api/auth/me 获取用户数据，避免重复的 NextAuth 调用

      // 🔥 登录成功后手动刷新状态（不等待，直接使用 loginData 中的 user）
      // refreshUserState() 会在后台更新状态，但不阻塞登录流程
      refreshUserState().catch(err => {
        console.warn('⚠️ [AuthProvider] refreshUserState 失败（不影响登录）:', err);
      });
      
      // 🔥 直接使用 loginData 中的 user 数据，不需要再次调用 /api/auth/me
      const userData = loginData.user || null;
      
      console.log('✅ [AuthProvider] 登录成功，用户:', userData?.email);
      return { success: true, user: userData };
    } catch (error: any) {
      console.error("❌ [AuthProvider] Login failed:", error);
      // 🔥 修复：保留原始错误信息
      return { 
        success: false, 
        error: error.message || 'Login failed',
        details: error.stack,
      };
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
