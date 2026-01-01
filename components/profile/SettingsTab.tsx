"use client";

import { useState, useEffect } from "react";
import { User, Mail, Lock, Bell, Save, CheckCircle } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/i18n/LanguageContext";

export default function SettingsTab() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // 初始化表单数据
  useEffect(() => {
    if (user) {
      setDisplayName(user.name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 实现实际的保存逻辑
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 个人资料 */}
      <div className="bg-[#0F111A] rounded-xl border border-pm-border p-6">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <User className="w-5 h-5" />
          {t('profile.settings.profile.title')}
        </h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-pm-text-dim mb-2">
              {t('profile.settings.profile.display_name')}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-pm-text-dim" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-pm-card border border-pm-border rounded-lg pl-10 pr-4 py-3 text-white placeholder-pm-text-dim focus:border-pm-green focus:ring-1 focus:ring-pm-green transition-all"
                placeholder={t('profile.settings.profile.display_name_placeholder')}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-pm-text-dim mb-2">
              {t('profile.settings.profile.email')}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-pm-text-dim" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-pm-card border border-pm-border rounded-lg pl-10 pr-4 py-3 text-white placeholder-pm-text-dim focus:border-pm-green focus:ring-1 focus:ring-pm-green transition-all"
                placeholder="your@email.com"
              />
            </div>
          </div>
        </form>
      </div>

      {/* 安全设置 */}
      <div className="bg-[#0F111A] rounded-xl border border-pm-border p-6">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Lock className="w-5 h-5" />
          {t('profile.settings.security.title')}
        </h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-pm-text-dim mb-2">
              {t('profile.settings.security.current_password')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-pm-text-dim" />
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-pm-card border border-pm-border rounded-lg pl-10 pr-4 py-3 text-white placeholder-pm-text-dim focus:border-pm-green focus:ring-1 focus:ring-pm-green transition-all"
                placeholder={t('profile.settings.security.current_password_placeholder')}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-pm-text-dim mb-2">
              {t('profile.settings.security.new_password')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-pm-text-dim" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-pm-card border border-pm-border rounded-lg pl-10 pr-4 py-3 text-white placeholder-pm-text-dim focus:border-pm-green focus:ring-1 focus:ring-pm-green transition-all"
                placeholder={t('profile.settings.security.new_password_placeholder')}
              />
            </div>
            <p className="mt-1 text-xs text-pm-text-dim">
              {t('profile.settings.security.password_hint')}
            </p>
          </div>
        </form>
      </div>

      {/* 通知设置 */}
      <div className="bg-[#0F111A] rounded-xl border border-pm-border p-6">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          {t('profile.settings.notifications.title')}
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-medium">{t('profile.settings.notifications.email')}</div>
              <div className="text-sm text-pm-text-dim">{t('profile.settings.notifications.email_desc')}</div>
            </div>
            <button
              onClick={() => setEmailNotifications(!emailNotifications)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                emailNotifications ? "bg-pm-green" : "bg-pm-border"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  emailNotifications ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-medium">{t('profile.settings.notifications.push')}</div>
              <div className="text-sm text-pm-text-dim">{t('profile.settings.notifications.push_desc')}</div>
            </div>
            <button
              onClick={() => setPushNotifications(!pushNotifications)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                pushNotifications ? "bg-pm-green" : "bg-pm-border"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  pushNotifications ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-pm-green hover:bg-green-400 text-white font-bold transition-all"
        >
          <Save className="w-4 h-4" />
          {t('profile.settings.save')}
        </button>
        {showSaveSuccess && (
          <span className="text-pm-green text-sm font-medium flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            {t('profile.settings.saved')}
          </span>
        )}
      </div>
    </div>
  );
}
