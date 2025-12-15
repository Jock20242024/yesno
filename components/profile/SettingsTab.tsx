"use client";

import { useState, useEffect } from "react";
import { Settings, Save, CheckCircle, User, Mail, Lock } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

export default function SettingsTab() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // 初始化表单数据
  useEffect(() => {
    if (user) {
      setDisplayName(user.name || "");
      setEmail("user@example.com"); // Mock email
    }
  }, [user]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 实现实际的保存逻辑
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 2000);
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
        <Settings className="w-5 h-5" />
        账户设置
      </h2>
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* 用户名 */}
        <div>
          <label
            htmlFor="displayName"
            className="block text-sm font-medium text-pm-text-dim mb-2"
          >
            用户名
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-pm-text-dim w-5 h-5" />
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-pm-bg border border-pm-border rounded-lg pl-10 pr-4 py-3 text-white placeholder-pm-text-dim focus:border-pm-blue focus:ring-0 transition-all"
              placeholder="请输入用户名"
            />
          </div>
        </div>

        {/* 电子邮箱 */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-pm-text-dim mb-2"
          >
            电子邮箱
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-pm-text-dim w-5 h-5" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-pm-bg border border-pm-border rounded-lg pl-10 pr-4 py-3 text-white placeholder-pm-text-dim focus:border-pm-blue focus:ring-0 transition-all"
              placeholder="your@email.com"
            />
          </div>
        </div>

        {/* 登录密码 */}
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-pm-text-dim mb-2"
          >
            登录密码
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-pm-text-dim w-5 h-5" />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-pm-bg border border-pm-border rounded-lg pl-10 pr-4 py-3 text-white placeholder-pm-text-dim focus:border-pm-blue focus:ring-0 transition-all"
              placeholder="••••••••"
            />
          </div>
          <p className="mt-1 text-xs text-pm-text-dim">
            留空则不修改密码
          </p>
        </div>

        {/* 保存按钮 */}
        <div className="flex items-center gap-4 pt-4">
          <button
            type="submit"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-pm-blue hover:bg-blue-600 text-white font-bold transition-all shadow-lg shadow-pm-blue/20"
          >
            <Save className="w-4 h-4" />
            保存设置
          </button>
          {showSaveSuccess && (
            <span className="text-pm-green text-sm font-medium flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              Saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

