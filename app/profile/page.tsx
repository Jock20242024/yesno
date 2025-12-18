"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNotification } from "@/components/providers/NotificationProvider";
import { Settings, Users, Key, LogOut, Loader2, BarChart3 } from "lucide-react";
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

export default function ProfilePage() {
  const { user, isLoggedIn, logout, currentUser } = useAuth();
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
  useEffect(() => {
    if (!isLoggedIn) {
      router.push("/login?redirect=/profile");
    }
  }, [isLoggedIn, router]);

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

  if (!isLoggedIn) {
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
      label: "概览",
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
                <div className="size-12 rounded-full overflow-hidden border-2 border-pm-border flex-shrink-0">
                  <img
                    src={user?.avatar || ""}
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
                <div className="flex flex-col gap-6">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <Loader2 className="w-8 h-8 animate-spin text-pm-green mb-4" />
                      <p className="text-white text-lg font-medium">Loading Profile...</p>
                    </div>
                  ) : error ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <p className="text-red-500 text-lg font-medium">Error: {error}</p>
                    </div>
                  ) : userData ? (
                    <>
                      {/* 统计信息 */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-pm-bg rounded-xl border border-pm-border p-6">
                          <div className="flex flex-col gap-2">
                            <span className="text-xs text-pm-text-dim uppercase tracking-wider">
                              总盈亏
                            </span>
                            <span
                              className={`text-2xl font-bold ${
                                (userData.profitLoss || 0) >= 0
                                  ? "text-pm-green"
                                  : "text-pm-red"
                              }`}
                            >
                              {formatUSD(userData.profitLoss || 0)}
                            </span>
                          </div>
                        </div>
                        <div className="bg-pm-bg rounded-xl border border-pm-border p-6">
                          <div className="flex flex-col gap-2">
                            <span className="text-xs text-pm-text-dim uppercase tracking-wider">
                              持仓价值
                            </span>
                            {/* 持仓价值 (Holding Value)：目前应为 $0.00（用户未下注） */}
                            {/* 强制修正：删除或修正任何显示 $537.34 的硬编码值 */}
                            <span className="text-2xl font-bold text-white">
                              {formatUSD(userData.positionsValue || 0)}
                            </span>
                          </div>
                        </div>
                        <div className="bg-pm-bg rounded-xl border border-pm-border p-6">
                          <div className="flex flex-col gap-2">
                            <span className="text-xs text-pm-text-dim uppercase tracking-wider">
                              最大胜利
                            </span>
                            <span className="text-2xl font-bold text-pm-green">
                              {formatUSD(userData.biggestWin || 0)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 持仓列表和交易历史 */}
                      <UserActivityTable />

                      {/* 充值和提现区域 */}
                      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 充值区域 */}
                        <div className="bg-pm-bg rounded-xl border border-pm-border p-6">
                          <h3 className="text-lg font-bold text-white mb-4">充值</h3>
                          <form onSubmit={handleDeposit} className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-pm-text-dim mb-2">
                                充值金额
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={depositAmount}
                                onChange={(e) => setDepositAmount(e.target.value)}
                                required
                                className="w-full bg-pm-card border border-pm-border rounded-lg px-4 py-3 text-white placeholder-pm-text-dim focus:border-pm-green focus:ring-1 focus:ring-pm-green transition-all"
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-pm-text-dim mb-2">
                                交易哈希（可选）
                              </label>
                              <input
                                type="text"
                                value={depositTxHash}
                                onChange={(e) => setDepositTxHash(e.target.value)}
                                className="w-full bg-pm-card border border-pm-border rounded-lg px-4 py-3 text-white placeholder-pm-text-dim focus:border-pm-green focus:ring-1 focus:ring-pm-green transition-all"
                                placeholder="自动生成（可选）"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={isDepositing}
                              className="w-full bg-pm-green hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-pm-bg font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                              {isDepositing ? (
                                <>
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                  处理中...
                                </>
                              ) : (
                                "确认充值"
                              )}
                            </button>
                          </form>
                        </div>

                        {/* 提现区域 */}
                        <div className="bg-pm-bg rounded-xl border border-pm-border p-6">
                          <h3 className="text-lg font-bold text-white mb-4">提现</h3>
                          <form onSubmit={handleWithdrawal} className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-pm-text-dim mb-2">
                                提现金额
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                required
                                className="w-full bg-pm-card border border-pm-border rounded-lg px-4 py-3 text-white placeholder-pm-text-dim focus:border-pm-green focus:ring-1 focus:ring-pm-green transition-all"
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-pm-text-dim mb-2">
                                提现地址
                              </label>
                              <input
                                type="text"
                                value={withdrawAddress}
                                onChange={(e) => setWithdrawAddress(e.target.value)}
                                required
                                className="w-full bg-pm-card border border-pm-border rounded-lg px-4 py-3 text-white placeholder-pm-text-dim focus:border-pm-green focus:ring-1 focus:ring-pm-green transition-all"
                                placeholder="0x..."
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={isWithdrawing}
                              className="w-full bg-pm-red hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                              {isWithdrawing ? (
                                <>
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                  处理中...
                                </>
                              ) : (
                                "提交提现请求"
                              )}
                            </button>
                          </form>
                        </div>
                      </div>

                      {/* 资金记录 */}
                      <div className="mt-6">
                        <h3 className="text-lg font-bold text-white mb-4">资金记录</h3>
                        {transactionsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-pm-green" />
                            <span className="ml-2 text-pm-text-dim">加载中...</span>
                          </div>
                        ) : transactionsError ? (
                          <div className="bg-pm-red/10 border border-pm-red/20 rounded-xl p-4">
                            <p className="text-pm-red text-sm">{transactionsError}</p>
                          </div>
                        ) : deposits.length === 0 && withdrawals.length === 0 ? (
                          <div className="bg-pm-bg rounded-xl border border-pm-border p-8 text-center">
                            <p className="text-pm-text-dim">暂无资金记录</p>
                          </div>
                        ) : (
                          <div className="bg-pm-bg rounded-xl border border-pm-border overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead className="bg-pm-card border-b border-pm-border">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-pm-text-dim uppercase tracking-wider">
                                      类型
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-pm-text-dim uppercase tracking-wider">
                                      金额
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-pm-text-dim uppercase tracking-wider">
                                      状态
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-pm-text-dim uppercase tracking-wider">
                                      时间
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-pm-border">
                                  {deposits.map((deposit) => (
                                    <TransactionRow
                                      key={deposit.id}
                                      type="deposit"
                                      amount={deposit.amount}
                                      status={deposit.status}
                                      createdAt={deposit.createdAt}
                                      extraInfo={deposit.txHash}
                                    />
                                  ))}
                                  {withdrawals.map((withdrawal) => (
                                    <TransactionRow
                                      key={withdrawal.id}
                                      type="withdrawal"
                                      amount={withdrawal.amount}
                                      status={withdrawal.status}
                                      createdAt={withdrawal.createdAt}
                                      extraInfo={withdrawal.targetAddress}
                                    />
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20">
                      <p className="text-pm-text-dim text-lg">No user data available</p>
                    </div>
                  )}
                </div>
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

