'use client'; // 1. 必须有这一行，否则报错

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// 定义数据类型
interface User {
  name: string;
  balance: string;
  avatar: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  currentUser: { id: string; email: string; role?: string; balance?: number; isAdmin?: boolean } | null; // 从 API 获取的用户信息，包含 role、balance 和 isAdmin
  login: (token?: string, userData?: { id: string; email: string; role?: string; balance?: number; isAdmin?: boolean }) => void;
  logout: () => void;
  updateBalance: (newBalance: string) => void; // 更新余额
  refreshUserState: () => Promise<void>; // 从 API 刷新用户状态
  isLoading: boolean; // 2. 新增加载状态，防止闪烁
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  user: null,
  currentUser: null,
  login: () => {},
  logout: () => {},
  updateBalance: () => {},
  refreshUserState: async () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; role?: string; balance?: number; isAdmin?: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化：先从 localStorage 恢复状态，然后通过 API 验证 Cookie 中的 authToken
  useEffect(() => {
    const restoreAndVerifyAuth = async () => {
      // 步骤 1: 先从 localStorage 恢复状态（防止闪烁）
      if (typeof window !== 'undefined') {
        try {
          const savedCurrentUser = localStorage.getItem('pm_currentUser');
          const savedUser = localStorage.getItem('pm_user');
          
          if (savedCurrentUser && savedUser) {
            try {
              const parsedCurrentUser = JSON.parse(savedCurrentUser);
              const parsedUser = JSON.parse(savedUser);
              
              // 强制检查：确保从 localStorage 恢复的 currentUser.id 是有效的 UUID
              // 不是硬编码的 '1' 或默认值
              if (!parsedCurrentUser.id || typeof parsedCurrentUser.id !== 'string' || parsedCurrentUser.id.trim() === '') {
                console.error('❌ [AuthProvider] localStorage 中的 currentUser.id 为空或无效');
                localStorage.removeItem('pm_currentUser');
                localStorage.removeItem('pm_user');
                return;
              }
              
              // 验证 parsedCurrentUser.id 是有效的 UUID 格式
              const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
              if (!uuidPattern.test(parsedCurrentUser.id)) {
                console.error('❌ [AuthProvider] localStorage 中的 currentUser.id 格式无效，不是有效的 UUID:', parsedCurrentUser.id);
                localStorage.removeItem('pm_currentUser');
                localStorage.removeItem('pm_user');
                return;
              }
              
              // 防止使用默认 ID（如 '1'）
              if (parsedCurrentUser.id === '1' || parsedCurrentUser.id === 'default') {
                console.error('❌ [AuthProvider] localStorage 中检测到无效的 currentUser.id（可能是硬编码的默认值）:', parsedCurrentUser.id);
                localStorage.removeItem('pm_currentUser');
                localStorage.removeItem('pm_user');
                return;
              }
              
              // 临时恢复状态（在 API 验证之前）
              setCurrentUser(parsedCurrentUser);
              setUser(parsedUser);
              setIsLoggedIn(true);
              
              console.log('🔄 [AuthProvider] 从 localStorage 恢复用户状态');
            } catch (parseError) {
              console.error('Failed to parse saved auth data:', parseError);
              // 清除无效的 localStorage 数据
              localStorage.removeItem('pm_currentUser');
              localStorage.removeItem('pm_user');
            }
          }
        } catch (error) {
          console.error('Error reading from localStorage:', error);
        }
      }

      // 步骤 2: 通过 API 验证 Cookie 中的 Token（确保状态一致性）
      try {
        console.log('🔍 [AuthProvider] 开始验证 NextAuth Session...');
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include', // 重要：包含 Cookie（NextAuth 的 session cookie）
          cache: 'no-store', // 防止缓存
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.user) {
            const userData = result.user;
            
            // 🔥 鉴权逻辑保活：即使数据格式异常，也只在控制台记录错误，不清除用户状态
            if (!userData.id || typeof userData.id !== 'string' || userData.id.trim() === '') {
              console.error('❌ [AuthProvider] API 返回的 user.id 为空或无效，但不清除状态（保活逻辑）');
              // 不清除状态，保持用户停留在当前 URL
              return;
            }
            
            // 验证 userData.id 是有效的 UUID 格式（不是硬编码的 '1' 或默认值）
            const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidPattern.test(userData.id)) {
              console.error('❌ [AuthProvider] API 返回的 user.id 格式无效，不是有效的 UUID:', userData.id, '但不清除状态（保活逻辑）');
              // 不清除状态，保持用户停留在当前 URL
              return;
            }
            
            // 防止使用默认 ID（如 '1'）
            if (userData.id === '1' || userData.id === 'default') {
              console.error('❌ [AuthProvider] 检测到无效的 user.id（可能是硬编码的默认值）:', userData.id, '但不清除状态（保活逻辑）');
              // 不清除状态，保持用户停留在当前 URL
              return;
            }
            
            const userDataWithRole = {
              ...userData,
              role: userData.isAdmin ? 'admin' : 'user',
            };
            
            setCurrentUser(userDataWithRole);
            setIsLoggedIn(true);
            
            // 存储用户信息到 localStorage（非敏感数据）
            localStorage.setItem('pm_currentUser', JSON.stringify(userDataWithRole));
            
            // 清洗旧数据：强制清理所有错误的、硬编码的或计算错误的余额字段
            // 所有资产相关字段（totalAsset, availableBalance, tradingBalance）必须基于 /api/auth/me 返回的真实 balance 值（即 $1000.00）进行同步
            // 格式化余额并创建用户对象
            // 强制确保 balance 是数字类型，处理 null、undefined 和字符串等情况
            let balance: number;
            if (userData.balance === null || userData.balance === undefined) {
              console.warn('⚠️ [AuthProvider] API 返回的余额为 null 或 undefined，使用默认值 0');
              balance = 0;
            } else {
              balance = Number(userData.balance);
              if (isNaN(balance)) {
                console.warn('⚠️ [AuthProvider] API 返回的余额无法转换为数字，使用默认值 0');
                balance = 0;
              }
            }
            
            // 清洗：排除所有已知的硬编码测试值（2450.32, 1900.46, 1900.45, 2437.799, 145.0等）
            // 统一资金：强制修正所有仍然显示 $1,900.45... 或 $2,437.799 USD 的账户/交易区组件
            // 如果检测到这些值，强制重置为 0 或从 API 重新获取
            const knownTestValues = [2450.32, 1900.46, 1900.45, 2437.799, 2437.8, 145.0];
            if (knownTestValues.includes(balance)) {
              console.warn('⚠️ [AuthProvider] 检测到硬编码的测试余额值，强制重置为 0:', balance);
              balance = 0;
            }
            
            // 确保余额不为负数
            balance = Math.max(0, balance);
            
            console.log('💰 [AuthProvider] 处理余额（已清洗旧数据）:', {
              rawBalance: userData.balance,
              processedBalance: balance,
              balanceType: typeof balance,
              isTestValue: knownTestValues.includes(Number(userData.balance)),
            });
            
            const formattedBalance = new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(balance);
            
            const defaultUser = {
              name: userData.email.split('@')[0], // 使用邮箱前缀作为显示名称
              balance: formattedBalance,
              avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuA2bAOWUUWgF3BeCg00tLrrCZ-3rEbDYjZILz2QLdrkatW3DtLEk1z-KKl-dTtsD6g0ZwQtpaw0k9GSFIozVD4vsoHuWlkK7WpkQr6WbewWw0uQz2H2BAlxCPDl2qelP2dy41f8iQ6RylaQ51hFuYhpHvGGnjNHJyMqPZcOjZuzPjRFCOtKBggU0ngBaXSyhVyf8gQ3Se-h0nHVxOoddZGgOn0Z6BXqMIM8nyldVRfe5eI8ZCcbr0NXKz-jqQdp5j0XzZF8PoRgMdYE"
            };
            setUser(defaultUser);
            localStorage.setItem('pm_user', JSON.stringify(defaultUser));
            
            console.log('✅ [AuthProvider] API 验证成功，用户状态已更新');
          } else {
            // 🔥 禁用自杀逻辑：API 返回失败，不清除状态（保持用户停留在当前 URL）
            console.warn('⚠️ [AuthProvider] API 验证失败，但不清除用户状态（禁用自杀逻辑）');
            // 注释掉所有执行 logout() 或清除用户状态的逻辑
            // setCurrentUser(null);
            // setUser(null);
            // setIsLoggedIn(false);
            // localStorage.removeItem('pm_currentUser');
            // localStorage.removeItem('pm_user');
          }
        } else {
          // 🔥 禁用自杀逻辑：API 返回非 200 状态码，不清除状态（保持用户停留在当前 URL）
          const statusText = response.status === 401 ? 'Session 无效或过期' : `HTTP ${response.status}`;
          console.warn(`⚠️ [AuthProvider] ${statusText}，但不清除用户状态（禁用自杀逻辑）`);
          
          // 注释掉所有执行 logout() 或清除用户状态的逻辑
          // 刷新时即便 API 没响应，也必须让用户停留在当前 URL，不准跳回登录页
          // if (response.status === 401) {
          //   setCurrentUser(null);
          //   setUser(null);
          //   setIsLoggedIn(false);
          //   localStorage.removeItem('pm_currentUser');
          //   localStorage.removeItem('pm_user');
          // }
        }
      } catch (error) {
        console.error('❌ [AuthProvider] Auth verification error:', error);
        // 🔥 禁用自杀逻辑：网络错误时，保留 localStorage 中的状态（可能是临时网络问题）
        // 刷新时即便 API 没响应，也必须让用户停留在当前 URL，不准跳回登录页
        // 注释掉所有清除状态的逻辑
        // if (!localStorage.getItem('pm_currentUser')) {
        //   setCurrentUser(null);
        //   setUser(null);
        //   setIsLoggedIn(false);
        // }
      } finally {
        setIsLoading(false);
      }
    };

    restoreAndVerifyAuth();
  }, []);

  // Login 函数：接收 user 数据（Token 现在在 HttpOnly Cookie 中）
  const login = (token?: string, userData?: { id: string; email: string; role?: string; balance?: number; isAdmin?: boolean }) => {
    if (userData) {
      // 强制检查：确保 currentUser.id 是从有效的 Auth Token 中动态解析出来的唯一 ID
      // 不是硬编码的 '1' 或默认值
      if (!userData.id || typeof userData.id !== 'string' || userData.id.trim() === '') {
        console.error('❌ [AuthProvider] Login: userData.id 为空或无效');
        return;
      }
      
      // 验证 userData.id 是有效的 UUID 格式（不是硬编码的 '1' 或默认值）
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(userData.id)) {
        console.error('❌ [AuthProvider] Login: userData.id 格式无效，不是有效的 UUID:', userData.id);
        return;
      }
      
      // 防止使用默认 ID（如 '1'）
      if (userData.id === '1' || userData.id === 'default') {
        console.error('❌ [AuthProvider] Login: 检测到无效的 userData.id（可能是硬编码的默认值）:', userData.id);
        return;
      }
      
      // Token 现在通过 HttpOnly Cookie 自动设置，无需手动存储
      // 确保存储完整的用户信息，包括 role 和 balance
      const userDataWithRole = {
        ...userData,
        role: userData.role || (userData.isAdmin ? 'admin' : 'user'),
      };
      
      // 清除旧用户的通知数据（强制数据隔离）
      // 在设置新用户之前，先清除可能存在的旧通知
      try {
        // 清理旧的全局通知键（向后兼容）
        localStorage.removeItem('pm_notifications');
        // 清理匿名通知
        localStorage.removeItem('pm_notifications_anonymous');
      } catch (e) {
        // 忽略错误
      }
      
      // 存储用户信息到 localStorage（非敏感数据）
      localStorage.setItem('pm_currentUser', JSON.stringify(userDataWithRole));
      setCurrentUser(userDataWithRole);
      
      // 清洗旧数据：强制清理所有错误的、硬编码的或计算错误的余额字段
      // 使用从 API 返回的余额（如果有），否则默认为 0
      // 强制确保 balance 是数字类型，处理 null、undefined 和字符串等情况
      let balance: number;
      if (userData.balance === null || userData.balance === undefined) {
        console.warn('⚠️ [AuthProvider] Login: API 返回的余额为 null 或 undefined，使用默认值 0');
        balance = 0;
      } else {
        balance = Number(userData.balance);
        if (isNaN(balance)) {
          console.warn('⚠️ [AuthProvider] Login: API 返回的余额无法转换为数字，使用默认值 0');
          balance = 0;
        }
      }
      
      // 清洗：排除所有已知的硬编码测试值
      // 统一资金：强制修正所有仍然显示 $1,900.45... 或 $2,437.799 USD 的账户/交易区组件
      const knownTestValues = [2450.32, 1900.46, 1900.45, 2437.799, 2437.8, 145.0];
      if (knownTestValues.includes(balance)) {
        console.warn('⚠️ [AuthProvider] Login: 检测到硬编码的测试余额值，强制重置为 0:', balance);
        balance = 0;
      }
      
      // 确保余额不为负数
      balance = Math.max(0, balance);
      
      const formattedBalance = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(balance);
      
      // 创建或更新用户数据，使用从 API 返回的真实余额
      const defaultUser = {
        name: userData.email.split('@')[0], // 使用邮箱前缀作为显示名称
        balance: formattedBalance,
        avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuA2bAOWUUWgF3BeCg00tLrrCZ-3rEbDYjZILz2QLdrkatW3DtLEk1z-KKl-dTtsD6g0ZwQtpaw0k9GSFIozVD4vsoHuWlkK7WpkQr6WbewWw0uQz2H2BAlxCPDl2qelP2dy41f8iQ6RylaQ51hFuYhpHvGGnjNHJyMqPZcOjZuzPjRFCOtKBggU0ngBaXSyhVyf8gQ3Se-h0nHVxOoddZGgOn0Z6BXqMIM8nyldVRfe5eI8ZCcbr0NXKz-jqQdp5j0XzZF8PoRgMdYE"
      };
      setUser(defaultUser);
      localStorage.setItem('pm_user', JSON.stringify(defaultUser));
    } else {
      // 兼容旧的快速登录方式（测试用）
      const mockUser = {
        name: "User123",
        balance: "$0.00",
        avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuA2bAOWUUWgF3BeCg00tLrrCZ-3rEbDYjZILz2QLdrkatW3DtLEk1z-KKl-dTtsD6g0ZwQtpaw0k9GSFIozVD4vsoHuWlkK7WpkQr6WbewWw0uQz2H2BAlxCPDl2qelP2dy41f8iQ6RylaQ51hFuYhpHvGGnjNHJyMqPZcOjZuzPjRFCOtKBggU0ngBaXSyhVyf8gQ3Se-h0nHVxOoddZGgOn0Z6BXqMIM8nyldVRfe5eI8ZCcbr0NXKz-jqQdp5j0XzZF8PoRgMdYE"
      };
      setUser(mockUser);
      localStorage.setItem('pm_user', JSON.stringify(mockUser));
    }
    setIsLoggedIn(true);
  };

  const logout = async () => {
    const userId = currentUser?.id;
    
    setUser(null);
    setCurrentUser(null);
    setIsLoggedIn(false);
    
    // 清除本地存储的用户信息
    localStorage.removeItem('pm_currentUser');
    localStorage.removeItem('pm_user');
    
    // 清除当前用户的通知数据（强制数据隔离）
    if (userId) {
      try {
        localStorage.removeItem(`pm_notifications_${userId}`);
      } catch (e) {
        // 忽略错误
      }
    }
    
    // 清理旧的全局通知键（向后兼容）
    try {
      localStorage.removeItem('pm_notifications');
    } catch (e) {
      // 忽略错误
    }
    
    // 调用后端 API 清除 Cookie
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout API error:', error);
    }
  };

  const updateBalance = useCallback((newBalance: string) => {
    if (user) {
      const updatedUser = { ...user, balance: newBalance };
      setUser(updatedUser);
      localStorage.setItem('pm_user', JSON.stringify(updatedUser));
    }
  }, [user]);

  // 从 API 刷新用户状态（用于注册/登录后立即更新状态）
  const refreshUserState = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          // 使用 login 方法更新状态（复用现有逻辑）
          login(undefined, {
            id: data.user.id,
            email: data.user.email,
            balance: data.user.balance || 0,
            isAdmin: data.user.isAdmin || false,
          });
        } else {
          // 🔥 禁用自杀逻辑：如果 API 返回失败，不清除状态（保持用户停留在当前 URL）
          console.warn('⚠️ [AuthProvider] refreshUserState: API 返回失败，但不清除状态（禁用自杀逻辑）');
          // 注释掉所有执行 logout() 或清除用户状态的逻辑
          // setIsLoggedIn(false);
          // setCurrentUser(null);
          // setUser(null);
          // localStorage.removeItem('pm_currentUser');
          // localStorage.removeItem('pm_user');
        }
      } else {
        // 🔥 禁用自杀逻辑：API 返回非 200，不清除状态（保持用户停留在当前 URL）
        console.warn('⚠️ [AuthProvider] refreshUserState: API 返回非 200，但不清除状态（禁用自杀逻辑）');
        // 注释掉所有执行 logout() 或清除用户状态的逻辑
        // setIsLoggedIn(false);
        // setCurrentUser(null);
        // setUser(null);
        // localStorage.removeItem('pm_currentUser');
        // localStorage.removeItem('pm_user');
      }
    } catch (error) {
      console.error('Failed to refresh user state:', error);
      // 网络错误时不清除状态（可能是临时网络问题）
    }
  }, [login]);

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, currentUser, login, logout, updateBalance, refreshUserState, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

