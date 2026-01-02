"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

function LoginForm() {
  const { t } = useLanguage();
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // 🔥 调用 AuthProvider 的 login 函数
      const res = await login({ email, password });
      
      // 🛑 [DEBUG] 登录接口返回原始数据日志

      if (!res.success) {
        const errorMessage = res.error === 'CredentialsSignin' ? t('auth.login.error_credentials') : res.error || t('auth.login.error');
        try {
          toast.error(errorMessage);
        } catch (e) {
          console.error("toast failed", e);
          toast.error(errorMessage);
        }
        return;
      }

      if (res.success && res.user) {
        // 显示成功提示
        try {
          toast.success(t('auth.login.success'));
        } catch (e) {
          console.error("toast failed", e);
        }

        // 🔥 物理清除所有"自动跳转"：登录成功后，直接使用 window.location.href 进行物理硬跳转
        // 物理刷新页面会强制清除浏览器路由缓存，绕过 Next.js 的缓存陷阱
        if (res.user.isAdmin) {
          window.location.href = '/admin/dashboard';
        } else {
          window.location.href = redirect || '/';
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      const errorMessage = t('auth.login.error_network');
      try {
        toast.error(errorMessage);
      } catch (e) {
        console.error("toast failed", e);
        toast.error(errorMessage);
      }
    }
  };

  return (
    <>
      <div className="flex-1 flex items-center justify-center p-4 md:p-6 lg:p-8">
        <div className="w-full max-w-md">
          <div className="bg-pm-card rounded-xl border border-pm-border p-8 shadow-2xl">
            <h1 className="text-2xl font-bold text-white mb-2">{t('auth.login.title')}</h1>
            <p className="text-pm-text-dim text-sm mb-6">
              {t('auth.login.subtitle')}
            </p>

            <div className="space-y-3 mb-6">
              <button
                type="button"
                onClick={async () => {
                  try {
                    // 🔥 修复：前端登录页面不应该跳转到后台，应该根据用户角色决定
                    const result = await signIn("google", {
                      callbackUrl: redirect || '/', // 使用 redirect 参数或首页
                      redirect: false, // 不自动跳转，手动控制
                    });
                    
                    if (result?.ok && !result?.error) {
                      // 🔥 修复：登录成功后，等待一小段时间让 session 建立
                      await new Promise(resolve => setTimeout(resolve, 500));
                      
                      // 登录成功，需要检查用户是否是管理员
                      // 先获取用户信息
                      try {
                        const userRes = await fetch('/api/auth/me', {
                          credentials: 'include',
                          cache: 'no-store',
                        });
                        if (userRes.ok) {
                          const userData = await userRes.json();
                          if (userData?.user?.isAdmin) {
                            // 管理员跳转到后台
                            window.location.href = '/admin/dashboard';
                          } else {
                            // 🔥 修复：普通用户跳转到首页或 redirect 参数，强制刷新页面
                            window.location.href = redirect || '/';
                          }
                        } else {
                          // 无法获取用户信息，默认跳转到首页
                          window.location.href = redirect || '/';
                        }
                      } catch (e) {
                        console.error("Failed to get user info:", e);
                        // 出错时默认跳转到首页
                        window.location.href = redirect || '/';
                      }
                    } else {
                      toast.error(t('auth.register.error_google'));
                    }
                  } catch (error) {
                    console.error("Google sign in error:", error);
                    try {
                      toast.error(t('auth.register.error_google'));
                    } catch (e) {
                      console.error("toast failed", e);
                    }
                  }
                }}
                className="w-full bg-pm-bg border border-pm-border hover:bg-pm-card-hover text-white font-medium py-3 rounded-lg transition-all text-sm"
              >
                {t('auth.login.google_login')}
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="pointer-events-none">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-pm-text-dim mb-2 pointer-events-auto"
                >
                  {t('auth.login.email_label')}
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
                  placeholder={t('auth.login.email_placeholder')}
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
                  {t('auth.login.password_label')}
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
                  placeholder={t('auth.login.password_placeholder')}
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
                {t('auth.login.submit')}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-pm-text-dim text-sm">
                {t('auth.login.no_account')}{" "}
                <a
                  href="/register"
                  className="text-pm-green hover:text-green-400 font-medium"
                >
                  {t('auth.login.sign_up_link')}
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center p-4 md:p-6 lg:p-8">
        <div className="w-full max-w-md">
          <div className="bg-pm-card rounded-xl border border-pm-border p-8 shadow-2xl">
            <div className="animate-pulse">
              <div className="h-8 bg-pm-bg rounded mb-2"></div>
              <div className="h-4 bg-pm-bg rounded mb-6"></div>
              <div className="space-y-4">
                <div className="h-12 bg-pm-bg rounded"></div>
                <div className="h-12 bg-pm-bg rounded"></div>
                <div className="h-12 bg-pm-bg rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
