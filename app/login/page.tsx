"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { isLoggedIn, login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  
  // 强制开启文本选择（DOM 注入）- 使用 !important 确保计算值为 text 而非 auto
  useEffect(() => {
    const emailInput = document.getElementById('email') as HTMLInputElement;
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    
    if (emailInput) {
      // 使用 setProperty 设置 !important，确保计算值为 text
      emailInput.style.setProperty('user-select', 'text', 'important');
      emailInput.style.setProperty('-webkit-user-select', 'text', 'important');
      emailInput.style.setProperty('-moz-user-select', 'text', 'important');
      emailInput.style.setProperty('-ms-user-select', 'text', 'important');
      emailInput.style.cursor = 'text';
      emailInput.draggable = false;
      // 阻止 IE/Edge 的选择阻断
      emailInput.onselectstart = (e) => {
        e.stopPropagation();
        return true;
      };
    }
    
    if (passwordInput) {
      // 使用 setProperty 设置 !important，确保计算值为 text
      passwordInput.style.setProperty('user-select', 'text', 'important');
      passwordInput.style.setProperty('-webkit-user-select', 'text', 'important');
      passwordInput.style.setProperty('-moz-user-select', 'text', 'important');
      passwordInput.style.setProperty('-ms-user-select', 'text', 'important');
      passwordInput.style.cursor = 'text';
      passwordInput.draggable = false;
      // 阻止 IE/Edge 的选择阻断
      passwordInput.onselectstart = (e) => {
        e.stopPropagation();
        return true;
      };
    }
  }, []);

  useEffect(() => {
    // 如果已经登录，直接跳转
    if (isLoggedIn) {
      router.push(redirect);
    }
  }, [isLoggedIn, redirect, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        // 显示成功提示
        try {
          toast.success("登录成功");
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
          router.push(redirect);
        }, 100);
      } else {
        const errorMessage = data.error || '登录失败';
        try {
          toast.error(errorMessage);
        } catch (e) {
          console.error("toast failed", e);
          alert(errorMessage);
        }
      }
    } catch (err) {
      const errorMessage = '网络错误，请稍后重试';
      try {
        toast.error(errorMessage);
      } catch (e) {
        console.error("toast failed", e);
        alert(errorMessage);
      }
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

            <div className="space-y-3 mb-6">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const result = await signIn("google", {
                      callbackUrl: redirect || "/",
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
                使用 Google 登录
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
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
                  draggable="false"
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
                  placeholder="your@email.com"
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
                  draggable="false"
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
                  placeholder="••••••••"
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
                className="w-full bg-pm-green hover:bg-green-400 text-pm-bg font-bold text-lg py-3.5 rounded-xl shadow-lg shadow-pm-green/20 transition-all active:scale-[0.98]"
              >
                登录
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-pm-text-dim text-sm">
                还没有账户？{" "}
                <a
                  href="/register"
                  className="text-pm-green hover:text-green-400 font-medium"
                >
                  立即注册
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
