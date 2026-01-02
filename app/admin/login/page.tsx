"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminEmail: email,
          adminPassword: password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('登录成功');
        window.location.href = '/admin/dashboard';
      } else {
        toast.error(data.error || '登录失败');
      }
    } catch (error) {
      console.error('Admin login error:', error);
      toast.error('登录失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0e13] via-[#111418] to-[#0a0e13] px-4">
      <div className="w-full max-w-md">
        <div className="bg-[#111418] border border-[#283545] rounded-2xl p-8 md:p-10 shadow-2xl">
          {/* Logo/标题 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl mb-6 shadow-lg">
              <span className="material-symbols-outlined text-white text-4xl">admin_panel_settings</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">后台管理系统</h1>
            <p className="text-sm text-[#9da8b9]">Admin Portal</p>
          </div>

          {/* 分隔线 */}
          <div className="flex items-center my-8">
            <div className="flex-1 border-t border-[#283545]"></div>
            <span className="px-4 text-xs text-[#637588] uppercase tracking-wider">管理员登录</span>
            <div className="flex-1 border-t border-[#283545]"></div>
          </div>

          {/* 邮箱密码登录表单 */}
          <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium text-[#9da8b9] mb-2">
                管理员邮箱
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#0a0e13] border border-[#283545] rounded-lg px-4 py-3 text-white placeholder-[#637588] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium text-[#9da8b9] mb-2">
                密码
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#0a0e13] border border-[#283545] rounded-lg px-4 py-3 text-white placeholder-[#637588] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              {isLoading ? '登录中...' : '登录'}
            </button>
          </form>

          {/* 分隔线 */}
          <div className="flex items-center my-6">
            <div className="flex-1 border-t border-[#283545]"></div>
            <span className="px-4 text-xs text-[#637588]">或</span>
            <div className="flex-1 border-t border-[#283545]"></div>
          </div>

          {/* Google 登录按钮 */}
          <button
            onClick={() => signIn('google', { callbackUrl: '/admin/dashboard' })}
            className="w-full py-4 bg-white hover:bg-gray-50 active:bg-gray-100 text-[#111418] font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-md hover:shadow-lg group"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-base">使用 Google 登录</span>
            <span className="material-symbols-outlined text-lg opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward</span>
          </button>

          {/* 提示信息 */}
          <div className="mt-8 pt-6 border-t border-[#283545]">
            <p className="text-xs text-center text-[#637588] leading-relaxed">
              使用邮箱密码或 Google 账号登录以访问管理后台
              <br />
              只有管理员账号可以访问
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
