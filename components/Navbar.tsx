"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, Trophy, User, Globe } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/i18n/LanguageContext";
import LiveWallet from "@/components/user/LiveWallet";

export default function Navbar() {
  const router = useRouter();
  const { isLoggedIn, user, currentUser, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [mounted, setMounted] = useState(false);
  const languageMenuRefLoggedIn = useRef<HTMLDivElement>(null);
  const languageMenuRefLoggedOut = useRef<HTMLDivElement>(null);

  // 🔥 修复 Hydration 错误：等待客户端挂载后再渲染动态内容
  useEffect(() => {
    setMounted(true);
  }, []);

  // 语言选项配置
  const languageOptions = [
    { code: 'zh' as const, label: '中文' },
    { code: 'en' as const, label: 'English' },
  ];

  // 点击外部关闭下拉框
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // 检查语言菜单（已登录或未登录状态）
      const languageMenuRef = languageMenuRefLoggedIn.current || languageMenuRefLoggedOut.current;
      if (
        showLanguageMenu &&
        languageMenuRef &&
        !languageMenuRef.contains(event.target as Node)
      ) {
        setShowLanguageMenu(false);
      }
    }

    if (showLanguageMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showLanguageMenu]);
  
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-solid border-border-dark bg-black/90 backdrop-blur-md px-2 md:px-4 lg:px-6 py-2 h-16 w-full">
      <div className="flex items-center gap-2 md:gap-4 lg:gap-8 w-full">
        <Link href="/" className="flex items-center gap-3 text-white hover:opacity-80 transition-opacity">
          <div className="size-8 text-primary flex-shrink-0">
            <svg
              className="w-full h-full"
              fill="none"
              viewBox="0 0 100 100"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="50" cy="50" fill="#d48a11" r="50" />
              <circle
                cx="50"
                cy="50"
                opacity="0.3"
                r="44"
                stroke="#000"
                strokeWidth="2"
              />
              <path
                d="M50 6 A 44 44 0 0 1 50 94"
                fill="#000"
                fillOpacity="0.1"
              />
              <line
                stroke="#000"
                strokeLinecap="round"
                strokeWidth="4"
                x1="50"
                x2="50"
                y1="10"
                y2="90"
              />
              <text
                fill="#000"
                fontFamily="sans-serif"
                fontSize="18"
                fontWeight="900"
                textAnchor="middle"
                transform="rotate(-90, 35, 50)"
                x="35"
                y="55"
              >
                YES
              </text>
              <text
                fill="#000"
                fontFamily="sans-serif"
                fontSize="18"
                fontWeight="900"
                textAnchor="middle"
                transform="rotate(90, 65, 50)"
                x="65"
                y="55"
              >
                NO
              </text>
            </svg>
          </div>
          <h2 className="text-white text-lg font-black leading-tight tracking-tight hidden sm:block">
            YesNo
          </h2>
        </Link>
        <form 
          className="hidden sm:flex flex-col min-w-40 !h-9 flex-1 ml-2 md:ml-4 max-w-[100px] md:max-w-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const searchQuery = formData.get('search') as string;
            if (searchQuery && searchQuery.trim()) {
              router.push(`/category/hot?search=${encodeURIComponent(searchQuery.trim())}`);
            }
          }}
        >
          <div className="flex w-full flex-1 items-stretch rounded-md h-full border border-border-dark bg-surface-dark hover:border-text-secondary focus-within:border-primary transition-colors">
            <div className="text-text-secondary flex items-center justify-center pl-3 pr-2">
              <Search className="w-[18px] h-[18px]" />
            </div>
            <input
              name="search"
              type="text"
              className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-md bg-transparent text-white focus:outline-none focus:ring-0 border-none h-full placeholder:text-text-secondary px-0 text-xs font-medium leading-normal"
              placeholder={mounted ? t('navbar.search_placeholder') : 'Search Market'}
              suppressHydrationWarning
              defaultValue=""
            />
          </div>
        </form>
        <div className="flex flex-1 justify-end gap-3 lg:gap-6 items-center">
          {isLoggedIn ? (
            <>
              <Link
                href="/rank"
                className="flex items-center gap-1 text-text-secondary text-xs font-bold hover:text-white transition-all uppercase tracking-wide group"
              >
                <Trophy 
                  className="w-[18px] h-[18px] transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" 
                  style={{
                    color: '#eab308',
                    filter: 'drop-shadow(0 0 4px rgba(234, 179, 8, 0.8)) drop-shadow(0 0 2px rgba(202, 138, 4, 0.6))',
                    strokeWidth: 2,
                  }}
                />
                <span className="hidden sm:inline" suppressHydrationWarning>
                  {mounted ? t('navbar.rank') : 'Rankings'}
                </span>
              </Link>
              <div className="h-5 w-px bg-border-dark" />
              {/* 语言切换器 */}
              <div className="relative" ref={languageMenuRefLoggedIn}>
                <button
                  onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                  className="flex items-center justify-center size-8 rounded-md bg-surface-dark border border-border-dark hover:border-text-secondary text-white transition-colors"
                  title={mounted ? (language === 'zh' ? 'Switch to English' : '切换到中文') : 'Switch Language'}
                  suppressHydrationWarning
                >
                  <Globe className="w-4 h-4" />
                </button>
                
                {showLanguageMenu && (
                  <div className="absolute right-0 top-full mt-2 w-32 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col">
                    <button
                      onClick={() => {
                        setLanguage('zh');
                        setShowLanguageMenu(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer border-b border-white/5 first:rounded-t-lg last:rounded-b-lg ${
                        language === 'zh'
                          ? 'bg-primary/20 text-primary font-bold'
                          : 'text-white hover:bg-white/10'
                      }`}
                    >
                      中文
                    </button>
                    <button
                      onClick={() => {
                        setLanguage('en');
                        setShowLanguageMenu(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer border-b border-white/5 first:rounded-t-lg last:rounded-b-lg last:border-b-0 ${
                        language === 'en'
                          ? 'bg-primary/20 text-primary font-bold'
                          : 'text-white hover:bg-white/10'
                      }`}
                    >
                      English
                    </button>
                  </div>
                )}
              </div>
              <div className="h-5 w-px bg-border-dark" />
              <div className="flex items-center gap-2 md:gap-3 flex-shrink-0 ml-auto">
                {/* 余额区域 - 点击跳转到钱包 */}
                <Link
                  href="/wallet"
                  prefetch={false}
                  className="flex items-center gap-2 md:gap-3 hover:opacity-80 transition-opacity cursor-pointer group flex-shrink-1 min-w-0"
                >
                  <div className="flex flex-col items-end mr-1">
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider leading-none mb-1" suppressHydrationWarning>
                      {mounted ? t('layout.header.total_assets') : 'Total Assets'}
                    </span>
                    <LiveWallet className="group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex flex-col items-end mr-2">
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider leading-none mb-1" suppressHydrationWarning>
                      {mounted ? t('layout.header.available') : 'Available'}
                    </span>
                    <LiveWallet className="text-poly-green group-hover:text-primary transition-colors" />
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  {/* 头像区域 - 点击跳转到个人中心 */}
                  <Link
                    href="/profile"
                    className="flex items-center justify-center size-8 rounded-full bg-surface-dark border border-border-dark hover:border-text-secondary text-white transition-colors ml-1 overflow-hidden cursor-pointer group"
                    title={mounted ? t('navbar.profile') : 'Profile'}
                    suppressHydrationWarning
                    style={{ position: 'relative', zIndex: 50 }}
                  >
                    {user?.avatar ? (
                      <img
                        alt="User"
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        src={user.avatar}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="w-5 h-5 opacity-80 group-hover:opacity-100 transition-opacity" />
                    )}
                  </Link>
                  {/* 登出按钮 */}
                  <button
                    onClick={async () => {
                      try {
                        // 🔥 先调用 logout 清除状态和 localStorage
                        await logout();
                        
                        // 🔥 确保所有状态已清除，然后再跳转
                        // 使用 replace 而不是 push，避免用户通过后退按钮返回
                        window.location.replace('/login');
                      } catch (error) {
                        console.error('❌ [Navbar] 登出失败:', error);
                        // 即使出错也强制跳转到登录页
                        window.location.replace('/login');
                      }
                    }}
                    className="flex items-center justify-center min-w-[44px] px-3 md:px-3 min-h-[44px] py-1.5 rounded-lg bg-surface-dark hover:bg-red-500/10 border border-border-dark hover:border-red-500/30 text-text-secondary hover:text-red-400 text-xs font-bold transition-colors ml-1 md:ml-2 flex-shrink-0"
                    title={mounted ? t('navbar.logout') : 'Logout'}
                    suppressHydrationWarning
                  >
                    <span className="hidden sm:inline" suppressHydrationWarning>
                      {mounted ? t('navbar.logout') : 'Logout'}
                    </span>
                    <span className="sm:hidden" suppressHydrationWarning>
                      {mounted ? (language === 'zh' ? '出' : 'Out') : 'Out'}
                    </span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              {/* 语言切换器（未登录时） */}
              <div className="relative" ref={languageMenuRefLoggedOut}>
                <button
                  onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                  className="flex items-center justify-center size-8 rounded-md bg-surface-dark border border-border-dark hover:border-text-secondary text-white transition-colors"
                  title={mounted ? (language === 'zh' ? 'Switch to English' : '切换到中文') : 'Switch Language'}
                  suppressHydrationWarning
                >
                  <Globe className="w-4 h-4" />
                </button>
                
                {showLanguageMenu && (
                  <div className="absolute right-0 top-full mt-2 w-32 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col">
                    <button
                      onClick={() => {
                        setLanguage('zh');
                        setShowLanguageMenu(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer border-b border-white/5 first:rounded-t-lg last:rounded-b-lg ${
                        language === 'zh'
                          ? 'bg-primary/20 text-primary font-bold'
                          : 'text-white hover:bg-white/10'
                      }`}
                    >
                      中文
                    </button>
                    <button
                      onClick={() => {
                        setLanguage('en');
                        setShowLanguageMenu(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer border-b border-white/5 first:rounded-t-lg last:rounded-b-lg last:border-b-0 ${
                        language === 'en'
                          ? 'bg-primary/20 text-primary font-bold'
                          : 'text-white hover:bg-white/10'
                      }`}
                    >
                      English
                    </button>
                  </div>
                )}
              </div>
              <Link
                href="/login"
                className="flex min-w-[44px] md:min-w-[80px] cursor-pointer items-center justify-center rounded-lg min-h-[44px] h-9 px-3 md:px-4 bg-surface-dark hover:bg-border-dark transition-colors text-white text-sm font-bold leading-normal tracking-wide border border-border-dark flex-shrink-0"
              >
                <span className="truncate text-xs md:text-sm" suppressHydrationWarning>
                  {mounted ? t('navbar.login') : 'Login'}
                </span>
              </Link>
              <Link
                href="/register"
                className="relative z-10 flex flex-shrink-0 min-w-[44px] md:min-w-[80px] cursor-pointer items-center justify-center rounded-lg min-h-[44px] h-9 px-3 md:px-4 bg-[#ec9c13] hover:bg-primary-hover transition-colors text-[#18181b] text-sm font-bold leading-normal tracking-wide shadow-[0_0_10px_rgba(236,156,19,0.2)] opacity-100 pointer-events-auto"
              >
                <span className="truncate text-[#18181b] opacity-100 text-xs md:text-sm" suppressHydrationWarning>
                  {mounted ? t('navbar.register') : 'Register'}
                </span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

