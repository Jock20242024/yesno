"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNotification } from "@/components/providers/NotificationProvider";
import { Settings, Users, Key, LogOut, Loader2, BarChart3, HelpCircle, Search, TrendingUp, Calendar, Share2, X } from "lucide-react";
import SettingsTab from "@/components/profile/SettingsTab";
import ReferralTab from "@/components/profile/ReferralTab";
import ApiManagementTab from "@/components/profile/ApiManagementTab";
import UserActivityTable from "@/components/user/UserActivityTable";
import { User, Activity, Position } from "@/types/api";
import { formatUSD } from "@/lib/utils";
import { useUserOrders } from "@/hooks/useUserOrders";
import { useUserTransactions } from "@/hooks/useUserTransactions";
import { Order, Deposit, Withdrawal, TransactionStatus } from "@/types/data";

type TabType = "overview" | "settings" | "referral" | "api";

// 个人概览组件（Polymarket 风格）
function OverviewTab({ 
  user, 
  userData, 
  isLoading, 
  error,
  orders,
  ordersLoading,
  addNotification,
}: {
  user: any;
  userData: any;
  isLoading: boolean;
  error: string | null;
  orders: any[];
  ordersLoading: boolean;
  addNotification: (notification: { type: "success" | "error" | "info"; title: string; message: string }) => void;
}) {
  const [timeFilter, setTimeFilter] = useState<"1D" | "1W" | "全部">("全部");
  const [listTab, setListTab] = useState<"positions" | "activity">("positions");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"value" | "none">("none");

  // 🔥 修复：从 API 返回的 positions 数据获取真实持仓（使用 useMemo 稳定引用，防止死循环）
  const rawPositions = useMemo(() => {
    return (userData?.positions || []) as Array<{
      id: string;
      marketId: string;
      outcome: string;
      shares: number;
      avgPrice: number;
      currentPrice: number;
      currentValue: number;
      costBasis: number;
      profitLoss: number;
    }>;
  }, [userData?.positions]);

  // 🔥 修复：从真实持仓数据计算总价值和盈亏
  const positionsValue = rawPositions.reduce((sum, pos) => sum + (pos.currentValue || 0), 0);
  const profitLoss = rawPositions.reduce((sum, pos) => sum + (pos.profitLoss || 0), 0);
  
  // 计算最大胜利（单笔最大盈利）
  const biggestWin = rawPositions.reduce((max, pos) => {
    const profit = pos.profitLoss || 0;
    return profit > max ? profit : max;
  }, 0);
  
  // 预测次数：持仓数量
  const predictionsCount = rawPositions.length;

  const userName = user?.name || user?.email?.split("@")[0] || "用户";
  const joinDate = "2025年10月加入"; // Mock 数据

  // 🔥 修复：使用真实持仓数据，并获取市场标题
  const [positionsWithMarketNames, setPositionsWithMarketNames] = useState<Array<{
    id: string;
    marketId: string;
    marketName: string;
    averagePrice: number;
    currentPrice: number;
    value: number;
    pnlPercent: number;
    shares: number;
  }>>([]);

  // 🔥 修复：使用 positions ID 和数量作为依赖，而不是整个数组（防止死循环）
  const positionsIds = useMemo(() => {
    return rawPositions.map(p => p.id).join(',');
  }, [rawPositions]);

  // 🔥 获取市场标题（修复：使用 positionsIds 作为依赖，避免死循环）
  useEffect(() => {
    // 如果 positionsIds 为空（没有持仓），清空列表并返回
    if (!positionsIds || rawPositions.length === 0) {
      setPositionsWithMarketNames([]);
      return;
    }

    let isCancelled = false; // 防止组件卸载后更新状态

    const fetchMarketNames = async () => {
      const positionsWithNames = await Promise.all(
        rawPositions.map(async (pos) => {
          try {
            const response = await fetch(`/api/markets/${pos.marketId}`);
            if (response.ok) {
              const result = await response.json();
              const marketTitle = result.success && result.data ? result.data.title : `市场 ${pos.marketId.slice(0, 8)}`;
              
              // 计算盈亏百分比（防止除以零）
              const pnlPercent = pos.costBasis > 0 
                ? ((pos.profitLoss || 0) / pos.costBasis) * 100 
                : 0;

              return {
                id: pos.id,
                marketId: pos.marketId,
                marketName: marketTitle,
                averagePrice: pos.avgPrice || 0,
                currentPrice: pos.currentPrice || 0,
                value: pos.currentValue || 0,
                pnlPercent,
                shares: pos.shares || 0,
              };
            }
          } catch (error) {
            console.error('Error fetching market name:', error);
          }
          
          // 如果获取失败，返回默认值（防止除以零）
          const pnlPercent = pos.costBasis > 0 
            ? ((pos.profitLoss || 0) / pos.costBasis) * 100 
            : 0;
          
          return {
            id: pos.id,
            marketId: pos.marketId,
            marketName: `市场 ${pos.marketId.slice(0, 8)}`,
            averagePrice: pos.avgPrice || 0,
            currentPrice: pos.currentPrice || 0,
            value: pos.currentValue || 0,
            pnlPercent,
            shares: pos.shares || 0,
          };
        })
      );

      // 只有在组件未卸载时才更新状态
      if (!isCancelled) {
        setPositionsWithMarketNames(positionsWithNames);
      }
    };

    fetchMarketNames();

    // 清理函数：标记为已取消
    return () => {
      isCancelled = true;
    };
  }, [positionsIds]); // 🔥 关键修复：只依赖 positionsIds，不依赖 rawPositions

  // 🔥 分享按钮处理函数
  const handleShare = async (marketId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发行的 onClick
    try {
      const url = `${window.location.origin}/markets/${marketId}`;
      await navigator.clipboard.writeText(url);
      addNotification({
        type: "success",
        title: "链接已复制",
        message: "市场链接已复制到剪贴板！",
      });
    } catch (error) {
      console.error('复制失败:', error);
      addNotification({
        type: "error",
        title: "复制失败",
        message: "无法复制链接，请手动复制",
      });
    }
  };

  const positions = positionsWithMarketNames;

  return (
    <div className="flex flex-col gap-6">
      {/* 顶部双栏布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：用户信息卡片 */}
        <div className="bg-[#0F111A] rounded-xl border border-pm-border p-6">
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-32 bg-pm-card rounded"></div>
              <div className="h-4 w-24 bg-pm-card rounded"></div>
              <div className="h-4 w-40 bg-pm-card rounded"></div>
            </div>
          ) : (
            <>
              {/* 用户名 */}
              <h2 className="text-2xl font-bold text-white mb-4">{userName}</h2>
              
              {/* 加入日期和社交链接 */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2 text-pm-text-dim text-sm">
                  <Calendar className="w-4 h-4" />
                  <span>{joinDate}</span>
                </div>
                <a 
                  href="#" 
                  className="flex items-center gap-2 text-pm-text-dim hover:text-white text-sm transition-colors"
                  onClick={(e) => { e.preventDefault(); }}
                >
                  <X size={16} className="text-pm-text-dim" />
                </a>
              </div>

              {/* 三个小指标 */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-pm-border">
                <div className="flex flex-col">
                  <span className="text-xs text-pm-text-dim uppercase tracking-wider mb-1">职位价值</span>
                  <span className="text-lg font-bold text-white">{formatUSD(positionsValue)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-pm-text-dim uppercase tracking-wider mb-1">最大胜利</span>
                  <span className="text-lg font-bold text-pm-green">{formatUSD(biggestWin)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-pm-text-dim uppercase tracking-wider mb-1">预测次数</span>
                  <span className="text-lg font-bold text-white">{predictionsCount}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 右侧：利润看板 */}
        <div className="bg-[#0F111A] rounded-xl border border-pm-border p-6">
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-24 bg-pm-card rounded"></div>
              <div className="h-12 w-48 bg-pm-card rounded"></div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">利润/亏损</h3>
                {/* 时间筛选 */}
                <div className="flex items-center gap-2">
                  {(["1D", "1W", "全部"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setTimeFilter(filter)}
                      className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                        timeFilter === filter
                          ? "bg-pm-green text-white"
                          : "text-pm-text-dim hover:text-white"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* 大数值 */}
              <div className="flex items-center gap-3">
                <span className={`text-4xl font-bold ${
                  profitLoss >= 0 ? "text-pm-green" : "text-pm-red"
                }`}>
                  {formatUSD(profitLoss)}
                </span>
                <HelpCircle className="w-5 h-5 text-pm-text-dim cursor-help" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* 下方列表区 */}
      <div className="bg-[#0F111A] rounded-xl border border-pm-border">
        {/* 标签页 */}
        <div className="border-b border-pm-border px-6">
          <div className="flex items-center gap-2">
            {[
              { id: "positions" as const, label: "职位" },
              { id: "activity" as const, label: "活动" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setListTab(tab.id)}
                className={`relative px-4 py-4 text-sm font-bold transition-colors ${
                  listTab === tab.id
                    ? "text-white"
                    : "text-pm-text-dim hover:text-white"
                }`}
              >
                {tab.label}
                {/* 激活线 */}
                {listTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-pm-green"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 操作栏 */}
        <div className="flex items-center gap-4 p-6 border-b border-pm-border">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-pm-text-dim" />
            <input
              type="text"
              placeholder="搜索职位"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-pm-card border border-pm-border rounded-lg pl-10 pr-4 py-2 text-white placeholder-pm-text-dim focus:border-pm-green focus:ring-1 focus:ring-pm-green transition-all"
            />
          </div>
          <button
            onClick={() => setSortBy(sortBy === "value" ? "none" : "value")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              sortBy === "value"
                ? "bg-pm-green/10 border-pm-green text-pm-green"
                : "border-pm-border text-pm-text-dim hover:text-white"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">价值</span>
          </button>
        </div>

        {/* 数据列表 */}
        <div className="p-6">
          {isLoading || ordersLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-4 p-4 bg-pm-card rounded-lg">
                  <div className="w-10 h-10 bg-pm-border rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 bg-pm-border rounded"></div>
                    <div className="h-3 w-32 bg-pm-border rounded"></div>
                  </div>
                  <div className="h-6 w-20 bg-pm-border rounded"></div>
                </div>
              ))}
            </div>
          ) : listTab === "positions" ? (
            positions.length > 0 ? (
              <div className="space-y-3">
                {positions.map((position) => (
                  <div
                    key={position.id}
                    className="flex items-center gap-4 p-4 bg-pm-card rounded-lg hover:bg-pm-card-hover transition-colors cursor-pointer group"
                    onClick={() => {
                      // 点击行跳转到市场详情页
                      window.location.href = `/markets/${position.marketId}`;
                    }}
                  >
                    {/* 左侧：市场图标和名称 */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                        BTC
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium truncate">{position.marketName}</div>
                        <div className="text-sm text-pm-text-dim">
                          平均值: {formatUSD(position.averagePrice)} | 当前的: {formatUSD(position.currentPrice)}
                        </div>
                      </div>
                    </div>

                    {/* 右侧：价值和盈亏 */}
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-white font-bold">{formatUSD(position.value)}</div>
                        <div className={`text-sm font-medium ${
                          position.pnlPercent >= 0 ? "text-pm-green" : "text-pm-red"
                        }`}>
                          {position.pnlPercent >= 0 ? "+" : ""}{position.pnlPercent.toFixed(2)}%
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleShare(position.marketId, e)}
                        className="p-2 rounded-lg text-pm-text-dim opacity-0 group-hover:opacity-100 hover:text-white hover:bg-white/10 transition-all"
                        title="分享市场链接"
                      >
                        <Share2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-pm-text-dim">
                <p>暂无职位</p>
              </div>
            )
          ) : (
            <div className="text-center py-12 text-pm-text-dim">
              <p>暂无活动记录</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, isLoggedIn, logout, currentUser, isLoading: authLoading } = useAuth();
  const { addNotification } = useNotification();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userData, setUserData] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 获取用户订单列表
  const { orders, isLoading: ordersLoading, error: ordersError, refetch: refetchOrders } = useUserOrders();
  
  // 获取用户交易记录（充值和提现）
  const { deposits, withdrawals, isLoading: transactionsLoading, error: transactionsError, refetch: refetchTransactions } = useUserTransactions();
  
  // 充值和提现表单状态
  const [depositAmount, setDepositAmount] = useState("");
  const [depositTxHash, setDepositTxHash] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // 如果未登录，重定向到登录页
  // 🔥 修复：增加 authLoading 判断，防止在身份验证状态未确认前误判并踢回登录页
  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      router.push("/login?redirect=/profile");
    }
  }, [authLoading, isLoggedIn, router]);

  // 获取用户详细数据
  useEffect(() => {
    const fetchUserData = async () => {
      if (!isLoggedIn || !currentUser) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/users/${currentUser.id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch user data");
        }
        const result = await response.json();
        if (result.success && result.data) {
          setUserData(result.data);
        } else {
          throw new Error(result.error || "Invalid response format");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error fetching user data.");
        console.error("Error fetching user data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (isLoggedIn && currentUser) {
      fetchUserData();
    }
  }, [isLoggedIn, currentUser]);

  if (!authLoading && !isLoggedIn) {
    return null;
  }

  // 处理充值
  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      addNotification({ type: "error", title: "输入错误", message: "请输入有效的充值金额" });
      return;
    }

    setIsDepositing(true);

    try {
      const response = await fetch("/api/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify({
          amount: parseFloat(depositAmount),
          txHash: depositTxHash || `TX-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        }),
      });

      const result = await response.json();

      if (result.success) {
        addNotification({
          type: "success",
          title: "充值成功！",
          message: `已成功充值 ${formatUSD(parseFloat(depositAmount))}`,
        });
        
        // 清空表单
        setDepositAmount("");
        setDepositTxHash("");
        
        // 刷新用户数据和交易记录
        if (currentUser) {
          const userResponse = await fetch(`/api/users/${currentUser.id}`);
          if (userResponse.ok) {
            const userResult = await userResponse.json();
            if (userResult.success && userResult.data) {
              setUserData(userResult.data);
            }
          }
        }
        refetchTransactions();
      } else {
        addNotification({
          type: "error",
          title: "充值失败",
          message: result.error || "请稍后重试",
        });
      }
    } catch (error) {
      console.error("Deposit error:", error);
      addNotification({
        type: "error",
        title: "充值失败",
        message: "网络错误，请稍后重试",
      });
    } finally {
      setIsDepositing(false);
    }
  };

  // 处理提现
  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      addNotification({ type: "error", title: "输入错误", message: "请输入有效的提现金额" });
      return;
    }

    if (!withdrawAddress || withdrawAddress.trim().length === 0) {
      addNotification({ type: "error", title: "输入错误", message: "请输入提现地址" });
      return;
    }

    setIsWithdrawing(true);

    try {
      const response = await fetch("/api/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify({
          amount: parseFloat(withdrawAmount),
          targetAddress: withdrawAddress.trim(),
        }),
      });

      const result = await response.json();

      if (result.success) {
        addNotification({
          type: "success",
          title: "提现请求已提交！",
          message: `提现金额: ${formatUSD(parseFloat(withdrawAmount))}，等待管理员审批`,
        });
        
        // 清空表单
        setWithdrawAmount("");
        setWithdrawAddress("");
        
        // 刷新用户数据和交易记录
        if (currentUser) {
          const userResponse = await fetch(`/api/users/${currentUser.id}`);
          if (userResponse.ok) {
            const userResult = await userResponse.json();
            if (userResult.success && userResult.data) {
              setUserData(userResult.data);
            }
          }
        }
        refetchTransactions();
      } else {
        addNotification({
          type: "error",
          title: "提现失败",
          message: result.error || "请稍后重试",
        });
      }
    } catch (error) {
      console.error("Withdrawal error:", error);
      addNotification({
        type: "error",
        title: "提现失败",
        message: "网络错误，请稍后重试",
      });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return; // 防止重复点击
    
    setIsLoggingOut(true);
    
    try {
      // 调用 Auth 上下文的退出方法
      logout();
      
      // 弹出通知提示
      addNotification({
        type: "success",
        title: "已安全退出",
        message: "您已成功退出登录",
      });
      
      // 延迟一下让通知显示，然后跳转
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // 跳转回首页
      router.push("/");
    } catch (error) {
      console.error("退出登录失败", error);
      addNotification({
        type: "error",
        title: "退出失败",
        message: "请稍后重试",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const menuItems = [
    {
      id: "overview" as TabType,
      label: "个人概览",
      icon: BarChart3,
    },
    {
      id: "settings" as TabType,
      label: "账户设置",
      icon: Settings,
    },
    {
      id: "referral" as TabType,
      label: "邀请返佣",
      icon: Users,
    },
    {
      id: "api" as TabType,
      label: "API 管理",
      icon: Key,
    },
  ];

  return (
    <>
      <div className="flex-1 max-w-[1600px] mx-auto w-full p-4 md:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          {/* 左侧侧边导航栏 */}
          <div className="lg:col-span-1">
            <div className="bg-pm-card rounded-xl border border-pm-border shadow-2xl p-4 sticky top-24">
              {/* 用户信息 */}
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-pm-border">
                <div className="size-12 rounded-full overflow-hidden border border-[#D4AF37] flex-shrink-0 bg-pm-card">
                  <img
                    src="/logo.svg"
                    alt={user?.name || "User"}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-white truncate">
                    {user?.name || "用户"}
                  </h2>
                  <p className="text-pm-text-dim text-xs">个人中心</p>
                </div>
              </div>

              {/* 导航菜单 */}
              <nav className="flex flex-col h-full">
                <div className="space-y-2 flex-1">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                          isActive
                            ? "bg-pm-green/10 text-pm-green border border-pm-green/30 shadow-lg shadow-pm-green/20"
                            : "text-pm-text-dim hover:text-white hover:bg-pm-card-hover border border-transparent"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
                
                {/* 退出登录按钮 */}
                <div className="mt-auto pt-4 border-t border-pm-border">
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all border border-transparent ${
                      isLoggingOut
                        ? "text-red-500/50 bg-red-500/5 cursor-not-allowed"
                        : "text-red-500 hover:text-red-400 hover:bg-red-500/10 border-red-500/20"
                    }`}
                  >
                    {isLoggingOut ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>退出中...</span>
                      </>
                    ) : (
                      <>
                        <LogOut className="w-5 h-5" />
                        <span>退出登录</span>
                      </>
                    )}
                  </button>
                </div>
              </nav>
            </div>
          </div>

          {/* 右侧内容区域 */}
          <div className="lg:col-span-3">
            <div className="bg-pm-card rounded-xl border border-pm-border shadow-2xl p-6 md:p-8">
              {activeTab === "overview" && (
                <OverviewTab 
                  user={user}
                  userData={userData}
                  isLoading={isLoading}
                  error={error}
                  orders={orders}
                  ordersLoading={ordersLoading}
                  addNotification={addNotification}
                />
              )}
              {activeTab === "settings" && <SettingsTab />}
              {activeTab === "referral" && <ReferralTab />}
              {activeTab === "api" && <ApiManagementTab />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// 交易记录行组件
function TransactionRow({
  type,
  amount,
  status,
  createdAt,
  extraInfo,
}: {
  type: 'deposit' | 'withdrawal';
  amount: number;
  status: TransactionStatus;
  createdAt: string;
  extraInfo: string;
}) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: TransactionStatus) => {
    const statusMap = {
      [TransactionStatus.PENDING]: { text: '待处理', className: 'bg-yellow-500/20 text-yellow-400' },
      [TransactionStatus.COMPLETED]: { text: '已完成', className: 'bg-pm-green/20 text-pm-green' },
      [TransactionStatus.FAILED]: { text: '失败', className: 'bg-pm-red/20 text-pm-red' },
    };
    const statusInfo = statusMap[status] || { text: status, className: 'bg-zinc-500/20 text-zinc-400' };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}>
        {statusInfo.text}
      </span>
    );
  };

  return (
    <tr className="hover:bg-pm-card transition-colors">
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className={`text-sm font-medium ${type === 'deposit' ? 'text-pm-green' : 'text-pm-red'}`}>
            {type === 'deposit' ? '充值' : '提现'}
          </span>
          <span className="text-xs text-pm-text-dim truncate max-w-[200px]" title={extraInfo}>
            {type === 'deposit' ? `哈希: ${extraInfo.slice(0, 10)}...` : `地址: ${extraInfo.slice(0, 10)}...`}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`text-sm font-medium ${type === 'deposit' ? 'text-pm-green' : 'text-pm-red'}`}>
          {type === 'deposit' ? '+' : '-'}{formatUSD(amount)}
        </span>
      </td>
      <td className="px-4 py-3">{getStatusBadge(status)}</td>
      <td className="px-4 py-3 text-sm text-pm-text-dim">{formatDate(createdAt)}</td>
    </tr>
  );
}

// 订单行组件
function OrderRow({ order }: { order: Order }) {
  const [marketTitle, setMarketTitle] = useState<string>('加载中...');

  useEffect(() => {
    // 获取市场标题
    const fetchMarketTitle = async () => {
      try {
        const response = await fetch(`/api/markets/${order.marketId}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setMarketTitle(result.data.title);
          }
        }
      } catch (error) {
        console.error('Error fetching market title:', error);
        setMarketTitle('未知市场');
      }
    };

    fetchMarketTitle();
  }, [order.marketId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <tr className="hover:bg-pm-card transition-colors">
      <td className="px-4 py-3 text-sm text-white">{marketTitle}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            order.outcomeSelection === 'YES'
              ? 'bg-pm-green/20 text-pm-green'
              : 'bg-pm-red/20 text-pm-red'
          }`}
        >
          {order.outcomeSelection}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-white font-medium">
        {formatUSD(order.amount)}
      </td>
      <td className="px-4 py-3 text-sm text-pm-text-dim">
        {formatUSD(order.feeDeducted)}
      </td>
      <td className="px-4 py-3 text-sm text-pm-text-dim">
        {formatDate(order.createdAt)}
      </td>
    </tr>
  );
}

