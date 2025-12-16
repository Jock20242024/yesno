"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { isLoggedIn, login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const message = searchParams.get("message");

  useEffect(() => {
    // 如果已经登录，直接跳转
    if (isLoggedIn) {
      router.push(redirect);
    }
    // 显示注册成功消息
    if (message) {
      setSuccessMessage(message);
    }
  }, [isLoggedIn, redirect, router, message]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // 验证邮箱格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError("请输入有效的邮箱地址");
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const result = await response.json();

      if (result.success && result.user) {
        // Token 已通过 HttpOnly Cookie 自动设置，无需手动存储
        // 调用 login 函数更新全局状态（使用占位 token，实际验证通过 Cookie）
        login('cookie-based-auth', result.user);
        
        // 根据用户角色决定重定向目标
        const targetRedirect = result.user.isAdmin ? '/admin/dashboard' : redirect;
        
        // 使用 setTimeout 确保状态更新后再跳转（给 React 状态更新一些时间）
        setTimeout(() => {
          router.push(targetRedirect);
        }, 100);
      } else {
        setError(result.error || "登录失败，请检查用户名和密码");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("登录失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex-1 flex items-center justify-center p-4 md:p-6 lg:p-8">
        <div className="w-full max-w-md">
          <div className="bg-pm-card rounded-xl border border-pm-border p-8 shadow-2xl">
            <h1 className="text-2xl font-bold text-white mb-2">登录</h1>
            <p className="text-pm-text-dim text-sm mb-6">
              登录您的账户以开始交易
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              {/* 成功提示 */}
              {successMessage && (
                <div className="p-3 rounded-lg bg-pm-green/10 border border-pm-green/20">
                  <p className="text-pm-green text-sm">{successMessage}</p>
                </div>
              )}
              {/* 错误提示 */}
              {error && (
                <div className="p-3 rounded-lg bg-pm-red/10 border border-pm-red/20">
                  <p className="text-pm-red text-sm">{error}</p>
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-pm-text-dim mb-2"
                >
                  邮箱
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-4 py-3 text-white placeholder-pm-text-dim focus:border-pm-green focus:ring-1 focus:ring-pm-green transition-all"
                  placeholder="example@email.com"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-pm-text-dim mb-2"
                >
                  密码
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-4 py-3 text-white placeholder-pm-text-dim focus:border-pm-green focus:ring-1 focus:ring-pm-green transition-all"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-pm-green hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-pm-bg font-bold text-lg py-3.5 rounded-xl shadow-lg shadow-pm-green/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-pm-bg border-t-transparent rounded-full animate-spin" />
                    登录中...
                  </>
                ) : (
                  "登录"
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-pm-text-dim text-sm">
                还没有账户？{" "}
                <Link
                  href="/register"
                  className="text-pm-green hover:text-green-400 font-medium"
                >
                  立即注册
                </Link>
              </p>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

