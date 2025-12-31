"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useNotification } from "@/components/providers/NotificationProvider";
import { Loader2, ArrowLeft, User, Mail, Calendar, DollarSign, Shield, Ban, TrendingUp, ShoppingCart, Wallet, FileText } from "lucide-react";

interface UserDetail {
  id: string;
  email: string;
  provider: string | null;
  balance: number;
  isAdmin: boolean;
  isBanned: boolean;
  createdAt: string;
  updatedAt: string;
  stats: {
    ordersCount: number;
    depositsCount: number;
    withdrawalsCount: number;
  };
  recentOrders: Array<{
    id: string;
    marketId: string;
    marketTitle: string;
    outcomeSelection: string;
    amount: number;
    payout: number | null;
    feeDeducted: number;
    createdAt: string;
  }>;
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addNotification } = useNotification();
  const userId = params.user_id as string;

  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取用户详情
  useEffect(() => {
    const fetchUserDetail = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/admin/users/${userId}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('获取用户详情失败');
        }

        const result = await response.json();

        if (result.success && result.data) {
          setUserDetail(result.data);
        } else {
          throw new Error(result.error || '获取用户详情失败');
        }
      } catch (err) {
        console.error('获取用户详情失败:', err);
        setError(err instanceof Error ? err.message : '获取用户详情失败');
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchUserDetail();
    }
  }, [userId]);

  // 禁用/启用用户
  const handleToggleBan = async () => {
    if (!userDetail) return;

    const action = userDetail.isBanned ? 'unban' : 'ban';
    const confirmMessage = userDetail.isBanned 
      ? `确定要启用用户 ${userDetail.email} 吗？`
      : `确定要禁用用户 ${userDetail.email} 吗？`;

    if (!window.confirm(confirmMessage)) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (data.success) {
        addNotification({
          type: 'success',
          title: '操作成功',
          message: userDetail.isBanned ? '用户已启用' : '用户已禁用',
        });
        // 重新获取用户详情
        window.location.reload();
      } else {
        addNotification({
          type: 'error',
          title: '操作失败',
          message: data.error || '操作失败',
        });
      }
    } catch (err) {
      console.error('禁用/启用用户失败:', err);
      addNotification({
        type: 'error',
        title: '操作失败',
        message: '操作失败，请稍后重试',
      });
    }
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }),
      time: date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      full: date.toLocaleString("zh-CN"),
    };
  };

  // 获取用户头像首字母
  const getInitials = (email: string) => {
    return email.split('@')[0]
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !userDetail) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-red-500">{error || '用户不存在'}</p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          返回
        </button>
      </div>
    );
  }

  const { date, time, full } = formatDate(userDetail.createdAt);
  const updatedDate = formatDate(userDetail.updatedAt);

  return (
    <div className="mx-auto max-w-[1200px] flex flex-col gap-6">
      {/* 头部导航 */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg border border-[#e5e7eb] dark:border-[#283545] bg-white dark:bg-[#101822] hover:bg-[#f3f4f6] dark:hover:bg-[#283545] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[#111418] dark:text-white" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#111418] dark:text-white">用户详情</h1>
          <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">查看和管理用户信息</p>
        </div>
      </div>

      {/* 用户基本信息卡片 */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* 用户头像和基本信息 */}
          <div className="flex items-start gap-4 flex-1">
            <div className="size-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
              {getInitials(userDetail.email)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold text-[#111418] dark:text-white">{userDetail.email}</h2>
                {userDetail.isBanned ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    已禁用
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    活跃
                  </span>
                )}
                {userDetail.isAdmin && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    管理员
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-[#637588] dark:text-[#9da8b9]" />
                  <span className="text-[#637588] dark:text-[#9da8b9]">邮箱:</span>
                  <span className="text-[#111418] dark:text-white font-medium">{userDetail.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="w-4 h-4 text-[#637588] dark:text-[#9da8b9]" />
                  <span className="text-[#637588] dark:text-[#9da8b9]">账户余额:</span>
                  <span className="text-[#111418] dark:text-white font-bold">
                    ${userDetail.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-[#637588] dark:text-[#9da8b9]" />
                  <span className="text-[#637588] dark:text-[#9da8b9]">注册时间:</span>
                  <span className="text-[#111418] dark:text-white">{full}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-[#637588] dark:text-[#9da8b9]" />
                  <span className="text-[#637588] dark:text-[#9da8b9]">登录方式:</span>
                  <span className="text-[#111418] dark:text-white">{userDetail.provider || 'email'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => router.push(`/admin/users/${userId}/edit`)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              编辑用户
            </button>
            <button
              onClick={handleToggleBan}
              className={`px-4 py-2 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 ${
                userDetail.isBanned
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
            >
              {userDetail.isBanned ? (
                <>
                  <Shield className="w-4 h-4" />
                  启用账户
                </>
              ) : (
                <>
                  <Ban className="w-4 h-4" />
                  禁用账户
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 统计数据卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <ShoppingCart className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-[#637588] dark:text-[#9da8b9]">订单总数</p>
              <p className="text-2xl font-bold text-[#111418] dark:text-white">{userDetail.stats.ordersCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Wallet className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-[#637588] dark:text-[#9da8b9]">充值次数</p>
              <p className="text-2xl font-bold text-[#111418] dark:text-white">{userDetail.stats.depositsCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <TrendingUp className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-[#637588] dark:text-[#9da8b9]">提现次数</p>
              <p className="text-2xl font-bold text-[#111418] dark:text-white">{userDetail.stats.withdrawalsCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 最近订单 */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#e5e7eb] dark:border-[#283545]">
          <h3 className="text-lg font-bold text-[#111418] dark:text-white">最近订单</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#f9fafb] dark:bg-[#101822]">
              <tr>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">订单ID</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">市场</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">方向</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-right">金额</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider text-right">手续费</th>
                <th className="p-4 text-xs font-bold text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">创建时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb] dark:divide-[#283545]">
              {userDetail.recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#637588] dark:text-[#9da8b9]">
                    暂无订单记录
                  </td>
                </tr>
              ) : (
                userDetail.recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#f9fafb] dark:hover:bg-[#1e2a36] transition-colors">
                    <td className="p-4">
                      <span className="text-sm font-mono text-[#111418] dark:text-white">{order.id.slice(0, 8)}...</span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-[#111418] dark:text-white">{order.marketTitle}</span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        order.outcomeSelection === 'YES'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {order.outcomeSelection}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-sm font-medium text-[#111418] dark:text-white">
                        ${order.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-sm text-[#637588] dark:text-[#9da8b9]">
                        ${order.feeDeducted.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-[#637588] dark:text-[#9da8b9]">
                        {formatDate(order.createdAt).full}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
