"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // 强制清除所有错误状态，确保不会显示之前的错误
    setError(null);

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("请输入有效的邮箱地址");
      setIsLoading(false);
      return;
    }

    // 验证密码确认
    if (password !== confirmPassword) {
      setError("密码和确认密码不匹配");
      setIsLoading(false);
      return;
    }

    // 客户端调试：确保数据已正确捕获
    console.log("Submitting:", { email, password: "***" }); // 不打印实际密码

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      // 检查响应状态码 - 如果成功（201 Created），立即重定向
      if (response.ok) {
        // 注册成功，强制清除错误状态（确保 UI 不显示错误）
        setError(null);
        setIsLoading(false); // 清除加载状态
        console.log("Register API success:", { status: response.status });
        
        // 注册成功，重定向到主页或登录页
        // 确保这里没有逻辑会再次设置错误状态
        router.push("/");
        // 或者使用: router.push("/login?message=注册成功，请登录");
        return; // 确保不执行后续的错误处理逻辑
      }

      // 错误处理逻辑（仅在 response.ok 为 false 时执行）
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || `HTTP ${response.status}: ${response.statusText}` };
      }
      console.error("Register API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData.error || errorData,
      });
      setError(errorData.error || `注册失败: ${response.status} ${response.statusText}`);
    } catch (err) {
      console.error("Register error:", err);
      setError("注册失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex-1 flex items-center justify-center p-4 md:p-6 lg:p-8">
        <div className="w-full max-w-md">
          <div className="bg-pm-card rounded-xl border border-pm-border p-8 shadow-2xl">
            <h1 className="text-2xl font-bold text-white mb-2">注册</h1>
            <p className="text-pm-text-dim text-sm mb-6">
              创建新账户以开始交易
            </p>

            <form onSubmit={handleRegister} className="space-y-4">
              {/* 错误提示 - 仅在非加载状态且存在错误时显示 */}
              {!isLoading && error && (
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
                  minLength={6}
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-4 py-3 text-white placeholder-pm-text-dim focus:border-pm-green focus:ring-1 focus:ring-pm-green transition-all"
                  placeholder="至少6个字符"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-pm-text-dim mb-2"
                >
                  确认密码
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-4 py-3 text-white placeholder-pm-text-dim focus:border-pm-green focus:ring-1 focus:ring-pm-green transition-all"
                  placeholder="再次输入密码"
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
                    注册中...
                  </>
                ) : (
                  "注册"
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-pm-text-dim text-sm">
                已有账户？{" "}
                <Link
                  href="/login"
                  className="text-pm-green hover:text-green-400 font-medium"
                >
                  立即登录
                </Link>
              </p>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

