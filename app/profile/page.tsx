"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { Settings, Users, Key, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import SettingsTab from "@/components/profile/SettingsTab";
import ReferralTab from "@/components/profile/ReferralTab";
import ApiManagementTab from "@/components/profile/ApiManagementTab";

type TabType = "settings" | "referral" | "api";

export default function ProfilePage() {
  const { user, isLoggedIn, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("settings");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // 如果未登录，重定向到登录页
  useEffect(() => {
    if (!isLoggedIn) {
      router.push("/login?redirect=/profile");
    }
  }, [isLoggedIn, router]);

  if (!isLoggedIn) {
    return null;
  }

  const handleLogout = async () => {
    if (isLoggingOut) return; // 防止重复点击
    
    setIsLoggingOut(true);
    
    try {
      // 调用 Auth 上下文的退出方法
      logout();
      
      // 弹出 Toast 提示
      toast.success("已安全退出", {
        description: "您已成功退出登录",
        duration: 2000,
      });
      
      // 延迟一下让 Toast 显示，然后跳转
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // 跳转回首页
      router.push("/");
    } catch (error) {
      console.error("退出登录失败", error);
      toast.error("退出失败", {
        description: "请稍后重试",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const menuItems = [
    {
      id: "settings" as TabType,
      label: "账户设置",
      icon: Settings,
    },
    {
      id: "referral" as TabType,
      label: "邀请返佣",
      icon: Users,
    },
    {
      id: "api" as TabType,
      label: "API 管理",
      icon: Key,
    },
  ];

  return (
    <>
      <div className="flex-1 max-w-[1600px] mx-auto w-full p-4 md:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          {/* 左侧侧边导航栏 */}
          <div className="lg:col-span-1">
            <div className="bg-pm-card rounded-xl border border-pm-border shadow-2xl p-4 sticky top-24">
              {/* 用户信息 */}
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-pm-border">
                <div className="size-12 rounded-full overflow-hidden border-2 border-pm-border flex-shrink-0">
                  <img
                    src={user?.avatar || ""}
                    alt={user?.name || "User"}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-white truncate">
                    {user?.name || "用户"}
                  </h2>
                  <p className="text-pm-text-dim text-xs">个人中心</p>
                </div>
              </div>

              {/* 导航菜单 */}
              <nav className="flex flex-col h-full">
                <div className="space-y-2 flex-1">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                          isActive
                            ? "bg-pm-green/10 text-pm-green border border-pm-green/30 shadow-lg shadow-pm-green/20"
                            : "text-pm-text-dim hover:text-white hover:bg-pm-card-hover border border-transparent"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
                
                {/* 退出登录按钮 */}
                <div className="mt-auto pt-4 border-t border-pm-border">
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all border border-transparent ${
                      isLoggingOut
                        ? "text-red-500/50 bg-red-500/5 cursor-not-allowed"
                        : "text-red-500 hover:text-red-400 hover:bg-red-500/10 border-red-500/20"
                    }`}
                  >
                    {isLoggingOut ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>退出中...</span>
                      </>
                    ) : (
                      <>
                        <LogOut className="w-5 h-5" />
                        <span>退出登录</span>
                      </>
                    )}
                  </button>
                </div>
              </nav>
            </div>
          </div>

          {/* 右侧内容区域 */}
          <div className="lg:col-span-3">
            <div className="bg-pm-card rounded-xl border border-pm-border shadow-2xl p-6 md:p-8">
              {activeTab === "settings" && <SettingsTab />}
              {activeTab === "referral" && <ReferralTab />}
              {activeTab === "api" && <ApiManagementTab />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

