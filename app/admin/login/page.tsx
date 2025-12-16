"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminLoginPage() {
  const router = useRouter();
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adminEmail,
          adminPassword,
        }),
      });

      // 检查响应状态
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // 登录成功，跳转到后台主页
        router.push("/admin/dashboard");
      } else {
        setError(result.error || "登录失败，请检查凭证");
      }
    } catch (error) {
      console.error("Admin login error:", error);
      setError(
        error instanceof Error 
          ? error.message 
          : "网络错误，请稍后重试"
      );
    } finally {
      // 确保 loading 状态总是被重置
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0e13] px-4">
      <div className="w-full max-w-md">
        <div className="bg-[#111418] border border-[#283545] rounded-xl p-8 shadow-lg">
          {/* Logo/标题 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-lg mb-4">
              <span className="material-symbols-outlined text-white text-3xl">admin_panel_settings</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">管理后台登录</h1>
            <p className="text-sm text-[#9da8b9]">请输入管理员凭证以继续</p>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* 登录表单 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="adminEmail" className="block text-sm font-medium text-[#9da8b9] mb-2">
                管理员邮箱
              </label>
              <input
                id="adminEmail"
                type="text"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[#0a0e13] border border-[#283545] rounded-lg text-white placeholder-[#637588] focus:outline-none focus:border-primary transition-colors"
                placeholder="管理员邮箱"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="adminPassword" className="block text-sm font-medium text-[#9da8b9] mb-2">
                密码
              </label>
              <input
                id="adminPassword"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[#0a0e13] border border-[#283545] rounded-lg text-white placeholder-[#637588] focus:outline-none focus:border-primary transition-colors"
                placeholder="请输入密码"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined animate-spin">refresh</span>
                  <span>登录中...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">login</span>
                  <span>登录</span>
                </>
              )}
            </button>
          </form>

          {/* 提示信息 */}
          <div className="mt-6 pt-6 border-t border-[#283545]">
            <p className="text-xs text-center text-[#637588]">
              管理员凭证：yesno@yesno.com / yesno2025
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

