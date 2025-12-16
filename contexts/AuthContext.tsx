"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  name: string;
  avatar: string;
  totalBalance: number;
  availableBalance: number;
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 默认用户数据（已废弃：不再使用硬编码的余额值）
// 清洗旧数据：所有余额字段必须基于 /api/auth/me 返回的真实 balance 值进行同步
const DEFAULT_USER: User = {
  name: "用户",
  avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuA2bAOWUUWgF3BeCg00tLrrCZ-3rEbDYjZILz2QLdrkatW3DtLEk1z-KKl-dTtsD6g0ZwQtpaw0k9GSFIozVD4vsoHuWlkK7WpkQr6WbewWw0uQz2H2BAlxCPDl2qelP2dy41f8iQ6RylaQ51hFuYhpHvGGnjNHJyMqPZcOjZuzPjRFCOtKBggU0ngBaXSyhVyf8gQ3Se-h0nHVxOoddZGgOn0Z6BXqMIM8nyldVRfe5eI8ZCcbr0NXKz-jqQdp5j0XzZF8PoRgMdYE",
  totalBalance: 0, // 清洗：不再使用硬编码的 2450.32，必须从 /api/auth/me 同步
  availableBalance: 0, // 清洗：不再使用硬编码的 145.0，必须从 /api/auth/me 同步
};

const STORAGE_KEY = "yesno_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // 从 localStorage 恢复登录状态
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.isLoggedIn && parsed.user) {
            setIsLoggedIn(true);
            setUser(parsed.user);
          }
        } catch (error) {
          console.error("Failed to parse auth data from localStorage", error);
        }
      }
    }
  }, []);

  const login = () => {
    setIsLoggedIn(true);
    setUser(DEFAULT_USER);
    // 保存到 localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          isLoggedIn: true,
          user: DEFAULT_USER,
        })
      );
    }
  };

  const logout = () => {
    setIsLoggedIn(false);
    setUser(null);
    // 清除 localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
