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
  login: () => void;
  logout: () => void;
  updateBalance: (newBalance: string) => void; // 更新余额
  isLoading: boolean; // 2. 新增加载状态，防止闪烁
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  user: null,
  login: () => {},
  logout: () => {},
  updateBalance: () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 3. 关键：页面加载时，先去 LocalStorage 查户口
  useEffect(() => {
    const storedUser = localStorage.getItem('pm_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        setIsLoggedIn(true);
      } catch (e) {
        console.error("解析用户数据失败", e);
        localStorage.removeItem('pm_user');
      }
    }
    setIsLoading(false); // 查完了，解除加载状态
  }, []);

  const login = () => {
    const mockUser = {
      name: "User123",
      balance: "$2,450.32",
      avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuA2bAOWUUWgF3BeCg00tLrrCZ-3rEbDYjZILz2QLdrkatW3DtLEk1z-KKl-dTtsD6g0ZwQtpaw0k9GSFIozVD4vsoHuWlkK7WpkQr6WbewWw0uQz2H2BAlxCPDl2qelP2dy41f8iQ6RylaQ51hFuYhpHvGGnjNHJyMqPZcOjZuzPjRFCOtKBggU0ngBaXSyhVyf8gQ3Se-h0nHVxOoddZGgOn0Z6BXqMIM8nyldVRfe5eI8ZCcbr0NXKz-jqQdp5j0XzZF8PoRgMdYE"
    };
    setUser(mockUser);
    setIsLoggedIn(true);
    // 4. 关键：登录时把数据存进硬盘（浏览器缓存）
    localStorage.setItem('pm_user', JSON.stringify(mockUser));
  };

  const logout = () => {
    setUser(null);
    setIsLoggedIn(false);
    // 5. 退出时删除
    localStorage.removeItem('pm_user');
  };

  const updateBalance = useCallback((newBalance: string) => {
    if (user) {
      const updatedUser = { ...user, balance: newBalance };
      setUser(updatedUser);
      localStorage.setItem('pm_user', JSON.stringify(updatedUser));
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, login, logout, updateBalance, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

