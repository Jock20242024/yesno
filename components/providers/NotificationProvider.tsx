"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "success" | "error" | "info";
  timestamp: number;
  read: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  addNotification: () => {},
  markAsRead: () => {},
  markAllAsRead: () => {},
  clearAll: () => {},
});

// 获取基于 userId 的存储键
const getStorageKey = (userId: string | null): string => {
  if (!userId) {
    return "pm_notifications_anonymous";
  }
  return `pm_notifications_${userId}`;
};

// 清理所有旧的通知数据（用于用户切换时）
const cleanupOldNotifications = () => {
  if (typeof window === 'undefined') return;
  
  // 清理旧的全局通知键（向后兼容）
  try {
    localStorage.removeItem("pm_notifications");
  } catch (e) {
    // 忽略错误
  }
  
  // 清理所有匿名通知
  try {
    localStorage.removeItem("pm_notifications_anonymous");
  } catch (e) {
    // 忽略错误
  }
};

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoggedIn } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 当用户登录状态变化时，重新加载通知
  useEffect(() => {
    const userId = currentUser?.id || null;
    
    // 如果用户 ID 发生变化，清除旧的通知并加载新的
    if (userId !== currentUserId) {
      // 清除旧的通知数据
      if (currentUserId) {
        const oldKey = getStorageKey(currentUserId);
        try {
          localStorage.removeItem(oldKey);
        } catch (e) {
          // 忽略错误
        }
      }
      
      // 更新当前用户 ID
      setCurrentUserId(userId);
      
      // 加载新用户的通知
      if (userId) {
        const storageKey = getStorageKey(userId);
        try {
          const stored = localStorage.getItem(storageKey);
          if (stored) {
            const parsed = JSON.parse(stored);
            setNotifications(Array.isArray(parsed) ? parsed : []);
          } else {
            // 新用户，初始化为空数组
            setNotifications([]);
          }
        } catch (e) {
          console.error("解析通知数据失败", e);
          setNotifications([]);
        }
      } else {
        // 未登录用户，清除通知
        setNotifications([]);
      }
    }
  }, [currentUser?.id, currentUserId]);

  // 当用户登出时，清除通知
  useEffect(() => {
    if (!isLoggedIn && currentUserId) {
      // 清除当前用户的通知
      const storageKey = getStorageKey(currentUserId);
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {
        // 忽略错误
      }
      setNotifications([]);
      setCurrentUserId(null);
    }
  }, [isLoggedIn, currentUserId]);

  // 保存到 localStorage（基于当前用户 ID）
  useEffect(() => {
    if (currentUserId && notifications.length > 0) {
      const storageKey = getStorageKey(currentUserId);
      try {
        localStorage.setItem(storageKey, JSON.stringify(notifications));
      } catch (e) {
        console.error("保存通知数据失败", e);
      }
    } else if (currentUserId && notifications.length === 0) {
      // 如果通知为空，也清除 localStorage（保持一致性）
      const storageKey = getStorageKey(currentUserId);
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {
        // 忽略错误
      }
    }
  }, [notifications, currentUserId]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const addNotification = (
    notification: Omit<Notification, "id" | "timestamp" | "read">
  ) => {
    // 只有在用户已登录时才添加通知
    if (!currentUserId) {
      console.warn("用户未登录，无法添加通知");
      return;
    }

    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      read: false,
    };

    setNotifications((prev) => [newNotification, ...prev].slice(0, 50)); // 最多保留50条
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
    if (currentUserId) {
      const storageKey = getStorageKey(currentUserId);
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {
        // 忽略错误
      }
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotification = () => useContext(NotificationContext);

