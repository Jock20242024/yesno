"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useNotification } from "@/components/providers/NotificationProvider";
import { Loader2, ArrowLeft, Save, X } from "lucide-react";

interface UserDetail {
  id: string;
  email: string;
  provider: string | null;
  balance: number;
  isAdmin: boolean;
  isBanned: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminUserEditPage() {
  const params = useParams();
  const router = useRouter();
  const { addNotification } = useNotification();
  const userId = params.user_id as string;

  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 表单数据
  const [formData, setFormData] = useState({
    email: '',
    isAdmin: false,
    isBanned: false,
  });

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
          setFormData({
            email: result.data.email,
            isAdmin: result.data.isAdmin,
            isBanned: result.data.isBanned,
          });
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

  // 处理表单输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.email.trim()) {
      addNotification({
        type: 'error',
        title: '输入错误',
        message: '邮箱不能为空',
      });
      return;
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      addNotification({
        type: 'error',
        title: '输入错误',
        message: '请输入有效的邮箱地址',
      });
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        addNotification({
          type: 'success',
          title: '操作成功',
          message: '用户信息已更新',
        });
        // 跳转回用户详情页
        router.push(`/admin/users/${userId}`);
      } else {
        addNotification({
          type: 'error',
          title: '操作失败',
          message: data.error || '更新失败',
        });
      }
    } catch (err) {
      console.error('更新用户信息失败:', err);
      addNotification({
        type: 'error',
        title: '操作失败',
        message: '更新失败，请稍后重试',
      });
    } finally {
      setIsSaving(false);
    }
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

  return (
    <div className="mx-auto max-w-[800px] flex flex-col gap-6">
      {/* 头部导航 */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg border border-[#e5e7eb] dark:border-[#283545] bg-white dark:bg-[#101822] hover:bg-[#f3f4f6] dark:hover:bg-[#283545] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[#111418] dark:text-white" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#111418] dark:text-white">编辑用户</h1>
          <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">修改用户信息</p>
        </div>
      </div>

      {/* 编辑表单 */}
      <form onSubmit={handleSubmit} className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6">
        <div className="space-y-6">
          {/* 用户ID（只读） */}
          <div>
            <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              用户ID
            </label>
            <input
              type="text"
              value={userDetail.id}
              disabled
              className="w-full px-3 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-[#f9fafb] dark:bg-[#1e2a36] text-[#637588] dark:text-[#9da8b9] cursor-not-allowed"
            />
          </div>

          {/* 邮箱 */}
          <div>
            <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              邮箱 <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* 管理员权限 */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="isAdmin"
                checked={formData.isAdmin}
                onChange={handleInputChange}
                className="w-4 h-4 rounded border-[#d1d5db] dark:border-[#3e4e63] text-primary focus:ring-primary"
              />
              <div>
                <span className="text-sm font-medium text-[#111418] dark:text-white">管理员权限</span>
                <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">授予用户管理员权限</p>
              </div>
            </label>
          </div>

          {/* 账户状态 */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="isBanned"
                checked={formData.isBanned}
                onChange={handleInputChange}
                className="w-4 h-4 rounded border-[#d1d5db] dark:border-[#3e4e63] text-red-500 focus:ring-red-500"
              />
              <div>
                <span className="text-sm font-medium text-[#111418] dark:text-white">禁用账户</span>
                <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">禁用后用户将无法登录系统</p>
              </div>
            </label>
          </div>

          {/* 只读信息 */}
          <div className="pt-4 border-t border-[#e5e7eb] dark:border-[#283545] space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[#637588] dark:text-[#9da8b9]">账户余额:</span>
              <span className="text-[#111418] dark:text-white font-medium">
                ${userDetail.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#637588] dark:text-[#9da8b9]">注册时间:</span>
              <span className="text-[#111418] dark:text-white">
                {new Date(userDetail.createdAt).toLocaleString("zh-CN")}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#637588] dark:text-[#9da8b9]">登录方式:</span>
              <span className="text-[#111418] dark:text-white">{userDetail.provider || 'email'}</span>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3 mt-6 pt-6 border-t border-[#e5e7eb] dark:border-[#283545]">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={isSaving}
            className="flex-1 px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg text-[#111418] dark:text-white bg-white dark:bg-[#101822] hover:bg-[#f3f4f6] dark:hover:bg-[#283545] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            取消
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                保存更改
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
