"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Trophy, Bell, CheckCircle, XCircle, Info, X } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNotification } from "@/components/providers/NotificationProvider";

// 格式化相对时间
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return new Date(timestamp).toLocaleDateString("zh-CN");
}

export default function Navbar() {
  const { isLoggedIn, user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉框
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
    }

    if (showNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showNotifications]);
  
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-solid border-border-dark bg-black/90 backdrop-blur-md px-4 lg:px-6 py-2 h-16">
      <div className="flex items-center gap-4 lg:gap-8 w-full max-w-[1600px] mx-auto">
        <Link href="/" className="flex items-center gap-3 text-white hover:opacity-80 transition-opacity">
          <div className="size-8 text-primary flex-shrink-0">
            <svg
              className="w-full h-full"
              fill="none"
              viewBox="0 0 100 100"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="50" cy="50" fill="currentColor" r="50" />
              <circle
                cx="50"
                cy="50"
                opacity="0.3"
                r="44"
                stroke="#000"
                strokeWidth="2"
              />
              <path
                d="M50 6 A 44 44 0 0 1 50 94"
                fill="#000"
                fillOpacity="0.1"
              />
              <line
                stroke="#000"
                strokeLinecap="round"
                strokeWidth="4"
                x1="50"
                x2="50"
                y1="10"
                y2="90"
              />
              <text
                fill="#000"
                fontFamily="sans-serif"
                fontSize="18"
                fontWeight="900"
                textAnchor="middle"
                transform="rotate(-90, 35, 50)"
                x="35"
                y="55"
              >
                YES
              </text>
              <text
                fill="#000"
                fontFamily="sans-serif"
                fontSize="18"
                fontWeight="900"
                textAnchor="middle"
                transform="rotate(90, 65, 50)"
                x="65"
                y="55"
              >
                NO
              </text>
            </svg>
          </div>
          <h2 className="text-white text-lg font-black leading-tight tracking-tight hidden sm:block">
            YesNo
          </h2>
        </Link>
        <label className="flex flex-col min-w-40 !h-9 max-w-sm flex-1 ml-4">
          <div className="flex w-full flex-1 items-stretch rounded-md h-full border border-border-dark bg-surface-dark hover:border-text-secondary focus-within:border-primary transition-colors">
            <div className="text-text-secondary flex items-center justify-center pl-3 pr-2">
              <Search className="w-[18px] h-[18px]" />
            </div>
            <input
              className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-md bg-transparent text-white focus:outline-none focus:ring-0 border-none h-full placeholder:text-text-secondary px-0 text-xs font-medium leading-normal"
              placeholder="搜索市场"
              defaultValue=""
            />
          </div>
        </label>
        <div className="flex flex-1 justify-end gap-3 lg:gap-6 items-center">
          {isLoggedIn ? (
            <>
              <Link
                href="/rank"
                className="flex items-center gap-1 text-text-secondary text-xs font-bold hover:text-white transition-colors uppercase tracking-wide"
              >
                <Trophy className="w-[18px] h-[18px]" />
                排行榜
              </Link>
              <div className="h-5 w-px bg-border-dark" />
              <div className="flex items-center gap-3">
                {/* 余额区域 - 点击跳转到钱包 */}
                <Link
                  href="/wallet"
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer group"
                >
                  <div className="flex flex-col items-end mr-1">
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider leading-none mb-1">
                      总资产
                    </span>
                    <span className="text-sm font-black text-white leading-none font-mono tracking-tight group-hover:text-primary transition-colors">
                      {user?.balance || "$0.00"}
                    </span>
                  </div>
                  <div className="flex flex-col items-end mr-2">
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider leading-none mb-1">
                      可用
                    </span>
                    <span className="text-sm font-black text-poly-green leading-none font-mono tracking-tight group-hover:text-primary transition-colors">
                      {user?.balance || "$0.00"}
                    </span>
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  {/* 通知按钮 */}
                  <div className="relative" ref={notificationRef}>
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="relative flex items-center justify-center size-8 rounded-md bg-surface-dark border border-border-dark hover:border-text-secondary text-white transition-colors"
                      title="通知"
                    >
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-black">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </button>

                    {/* 通知下拉框 */}
                    {showNotifications && (
                      <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                        {/* 头部 */}
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                          <h3 className="text-white text-sm font-bold">通知</h3>
                          <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                              <button
                                onClick={markAllAsRead}
                                className="text-xs text-zinc-400 hover:text-white transition-colors"
                              >
                                全部已读
                              </button>
                            )}
                            <button
                              onClick={() => setShowNotifications(false)}
                              className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* 通知列表 */}
                        <div className="max-h-96 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="p-8 text-center">
                              <p className="text-zinc-500 text-sm">暂无通知</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-white/10">
                              {notifications.map((notification) => {
                                const Icon =
                                  notification.type === "success"
                                    ? CheckCircle
                                    : notification.type === "error"
                                    ? XCircle
                                    : Info;
                                const iconColor =
                                  notification.type === "success"
                                    ? "text-emerald-500"
                                    : notification.type === "error"
                                    ? "text-rose-500"
                                    : "text-blue-500";

                                return (
                                  <div
                                    key={notification.id}
                                    onClick={() => {
                                      if (!notification.read) {
                                        markAsRead(notification.id);
                                      }
                                    }}
                                    className={`p-4 cursor-pointer transition-colors ${
                                      notification.read
                                        ? "bg-transparent"
                                        : "bg-white/5 hover:bg-white/10"
                                    }`}
                                  >
                                    <div className="flex items-start gap-3">
                                      <Icon
                                        className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColor}`}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                          <h4 className="text-white text-sm font-bold">
                                            {notification.title}
                                          </h4>
                                          {!notification.read && (
                                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                                          )}
                                        </div>
                                        <p className="text-zinc-400 text-xs mb-2">
                                          {notification.message}
                                        </p>
                                        <span className="text-zinc-500 text-[10px]">
                                          {formatRelativeTime(notification.timestamp)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* 底部 */}
                        {notifications.length > 0 && (
                          <div className="p-3 border-t border-white/10">
                            <Link
                              href="#"
                              onClick={() => setShowNotifications(false)}
                              className="block text-center text-xs text-zinc-400 hover:text-white transition-colors"
                            >
                              查看所有
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* 头像区域 - 点击跳转到个人中心 */}
                  <Link
                    href="/profile"
                    className="flex items-center justify-center size-8 rounded-full bg-surface-dark border border-border-dark hover:border-text-secondary text-white transition-colors ml-1 overflow-hidden cursor-pointer group"
                    title="账户"
                  >
                    <img
                      alt="User"
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      src={user?.avatar || ""}
                    />
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <div className="flex gap-3">
              <Link
                href="/login"
                className="flex min-w-[80px] cursor-pointer items-center justify-center rounded-lg h-9 px-4 bg-surface-dark hover:bg-border-dark transition-colors text-white text-sm font-bold leading-normal tracking-wide border border-border-dark"
              >
                <span className="truncate">登录</span>
              </Link>
              <Link
                href="/login"
                className="flex min-w-[80px] cursor-pointer items-center justify-center rounded-lg h-9 px-4 bg-primary hover:bg-primary-hover transition-colors text-[#18181b] text-sm font-bold leading-normal tracking-wide shadow-[0_0_10px_rgba(236,156,19,0.2)]"
              >
                <span className="truncate">注册</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

