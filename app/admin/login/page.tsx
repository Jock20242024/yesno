"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();

  // 🔥 修复：如果已登录且是管理员，重定向到后台
  useEffect(() => {
    if (session?.user) {
      const isAdmin = (session.user as any).isAdmin;
      if (isAdmin === true) {
        router.replace('/admin/dashboard');
      }
    }
  }, [session, router]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('🔐 [Admin Login] 开始登录请求...', { email });
      
      // 🔥 关键修复：直接使用 NextAuth 的 signIn 方法
      // 这会自动创建 session 并设置 next-auth.session-token cookie
      const result = await signIn('credentials', {
        email: email,
        password: password,
        redirect: false, // 不自动跳转，手动控制
      });

      console.log('📡 [Admin Login] NextAuth signIn 结果:', result);

      if (result?.error) {
        console.error('❌ [Admin Login] NextAuth signIn 失败:', result.error);
        let errorMessage = '登录失败';
        
        if (result.error === 'CredentialsSignin') {
          errorMessage = '邮箱或密码错误';
        } else if (result.error === 'GOOGLE_USER_MUST_USE_OAUTH') {
          errorMessage = '此账号使用 Google 登录注册，请使用 Google 登录按钮登录';
        }
        
        toast.error(errorMessage);
        setIsLoading(false);
        return;
      }

      if (result?.ok) {
        console.log('🎉 [Admin Login] NextAuth 登录成功！');
        console.log('🔍 [Admin Login] 当前路径:', window.location.pathname);
        
        // 🔥 修复：等待 session 更新后验证用户是否是管理员
        // 使用 setTimeout 等待 NextAuth session 更新
        setTimeout(async () => {
          // 重新获取 session 以验证 isAdmin
          const response = await fetch('/api/auth/session');
          const sessionData = await response.json();
          
          if (sessionData?.user) {
            const isAdmin = (sessionData.user as any).isAdmin;
            if (isAdmin !== true) {
              console.error('❌ [Admin Login] 用户不是管理员，拒绝访问后台');
              toast.error('您没有管理员权限，无法访问后台');
              setIsLoading(false);
              return;
            }
          }
          
          // 🔥 绝杀修复：先清除所有 localStorage 缓存，确保没有旧数据干扰
          console.log('🧹 [Admin Login] 清除 localStorage 缓存...');
          try {
            window.localStorage.clear();
            console.log('✅ [Admin Login] localStorage 已清除');
          } catch (clearError) {
            console.warn('⚠️ [Admin Login] 清除 localStorage 失败:', clearError);
          }
          
          // 🔥 绝杀修复：使用 replace 而不是 href，避免历史记录问题
          console.log('🚀 [Admin Login] 执行硬跳转: window.location.replace("/admin/dashboard")');
          window.location.replace('/admin/dashboard');
        }, 500); // 等待 500ms 让 session 更新
        return;
      }

      // 如果既没有 error 也没有 ok，说明出现了未知情况
      console.error('❌ [Admin Login] NextAuth signIn 返回未知结果:', result);
      toast.error('登录失败，请稍后重试');
      setIsLoading(false);
    } catch (error) {
      console.error('❌ [Admin Login] 登录异常:', error);
      console.error('❌ [Admin Login] 错误详情:', error instanceof Error ? error.message : String(error));
      toast.error('登录失败，请稍后重试');
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
