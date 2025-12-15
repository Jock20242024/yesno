"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { isLoggedIn, login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  useEffect(() => {
    // 如果已经登录，直接跳转
    if (isLoggedIn) {
      router.push(redirect);
    }
  }, [isLoggedIn, redirect, router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 实现实际的登录逻辑（API 调用等）
    // 这里暂时模拟登录成功
    login();
    router.push(redirect);
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
                  placeholder="your@email.com"
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
                className="w-full bg-pm-green hover:bg-green-400 text-pm-bg font-bold text-lg py-3.5 rounded-xl shadow-lg shadow-pm-green/20 transition-all active:scale-[0.98]"
              >
                登录
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-pm-text-dim text-sm">
                还没有账户？{" "}
                <a
                  href="#"
                  className="text-pm-green hover:text-green-400 font-medium"
                >
                  立即注册
                </a>
              </p>
            </div>

            {/* 临时快速登录按钮（用于测试） */}
            <div className="mt-4 pt-4 border-t border-pm-border">
              <button
                onClick={() => {
                  login();
                  router.push(redirect);
                }}
                className="w-full bg-pm-card-hover hover:bg-pm-card border border-pm-border text-white font-medium py-2 rounded-lg transition-all text-sm"
              >
                快速登录（测试用）
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

