"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "sonner";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { login } = useAuth();
  
  // 强制开启文本选择（DOM 注入）
  useEffect(() => {
    const emailInput = document.getElementById('email') as HTMLInputElement;
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    const confirmPasswordInput = document.getElementById('confirmPassword') as HTMLInputElement;
    
    const setupInput = (input: HTMLInputElement | null) => {
      if (input) {
        // 使用 setProperty 设置 !important，确保计算值为 text 而非 auto
        input.style.setProperty('user-select', 'text', 'important');
        input.style.setProperty('-webkit-user-select', 'text', 'important');
        input.style.setProperty('-moz-user-select', 'text', 'important');
        input.style.setProperty('-ms-user-select', 'text', 'important');
        input.style.cursor = 'text';
        input.draggable = false;
        // 阻止 IE/Edge 的选择阻断
        input.onselectstart = (e) => {
          e.stopPropagation();
          return true;
        };
      }
    };
    
    setupInput(emailInput);
    setupInput(passwordInput);
    setupInput(confirmPasswordInput);
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
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

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setError(null);
        setIsLoading(false);
        
        // 显示成功提示
        try {
          toast.success("注册成功，正在登录...");
        } catch (e) {
          console.error("toast failed", e);
        }

        // 立即更新 AuthProvider 状态
        if (data.user && data.token) {
          login(data.token, data.user);
        }

        // 等待一小段时间确保状态更新完成，然后跳转
        setTimeout(() => {
          router.refresh();
          router.push("/");
        }, 100);
        return;
      }

      // 处理错误响应
      const errorMessage = data.error || data.message || `注册失败: ${response.status} ${response.statusText}`;
      setError(errorMessage);
      
      // 显示错误提示
      try {
        toast.error(errorMessage);
      } catch (e) {
        console.error("toast failed", e);
      }
    } catch (err) {
      const errorMessage = "注册失败，请稍后重试";
      setError(errorMessage);
      try {
        toast.error(errorMessage);
      } catch (e) {
        console.error("toast failed", e);
      }
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

            <div className="space-y-3 mb-6">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const result = await signIn("google", {
                      callbackUrl: "/",
                      redirect: true,
                    });
                    if (result?.error) {
                      try {
                        toast.error("Google 登录失败");
                      } catch (e) {
                        console.error("toast failed", e);
                      }
                    }
                  } catch (error) {
                    console.error("Google sign in error:", error);
                    try {
                      toast.error("Google 登录失败，请稍后重试");
                    } catch (e) {
                      console.error("toast failed", e);
                    }
                  }
                }}
                className="w-full bg-pm-bg border border-pm-border hover:bg-pm-card-hover text-white font-medium py-3 rounded-lg transition-all text-sm"
              >
                使用 Google 邮箱注册
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              {!isLoading && error && (
                <div className="p-3 rounded-lg bg-pm-red/10 border border-pm-red/20 pointer-events-auto">
                  <p className="text-pm-red text-sm">{error}</p>
                </div>
              )}

              <div className="pointer-events-none">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-pm-text-dim mb-2 pointer-events-auto"
                >
                  邮箱
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  draggable={false}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                  }}
                  onSelect={(e) => {
                    e.stopPropagation();
                  }}
                  required
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-4 py-3 text-white placeholder-pm-text-dim focus:border-pm-green focus:ring-1 focus:ring-pm-green transition-all select-text pointer-events-auto"
                  placeholder="example@email.com"
                  style={{
                    userSelect: 'text',
                    WebkitUserSelect: 'text',
                    cursor: 'text',
                    position: 'relative',
                    zIndex: 50,
                  } as React.CSSProperties}
                />
              </div>

              <div className="pointer-events-none">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-pm-text-dim mb-2 pointer-events-auto"
                >
                  密码
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  draggable={false}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                  }}
                  onSelect={(e) => {
                    e.stopPropagation();
                  }}
                  required
                  minLength={6}
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-4 py-3 text-white placeholder-pm-text-dim focus:border-pm-green focus:ring-1 focus:ring-pm-green transition-all select-text pointer-events-auto"
                  placeholder="至少6个字符"
                  style={{
                    userSelect: 'text',
                    WebkitUserSelect: 'text',
                    cursor: 'text',
                    position: 'relative',
                    zIndex: 50,
                  } as React.CSSProperties}
                />
              </div>

              <div className="pointer-events-none">
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-pm-text-dim mb-2 pointer-events-auto"
                >
                  确认密码
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  draggable={false}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                  }}
                  onSelect={(e) => {
                    e.stopPropagation();
                  }}
                  required
                  minLength={6}
                  className="w-full bg-pm-bg border border-pm-border rounded-lg px-4 py-3 text-white placeholder-pm-text-dim focus:border-pm-green focus:ring-1 focus:ring-pm-green transition-all select-text pointer-events-auto"
                  placeholder="再次输入密码"
                  style={{
                    userSelect: 'text',
                    WebkitUserSelect: 'text',
                    cursor: 'text',
                    position: 'relative',
                    zIndex: 50,
                  } as React.CSSProperties}
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
