"use client";

import { useState, useEffect } from "react";
import { Copy, Check, Users, DollarSign, Clock, User, Loader2 } from "lucide-react";
import { formatUSD } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";

interface ReferredUser {
  id: string;
  username: string;
  registeredAt: string;
  contribution: number;
}

interface ReferralData {
  referralCode: string;
  referralLink: string;
  totalEarnings: number;
  invitedCount: number;
  referredUsers: ReferredUser[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export default function ReferralTab() {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referralData, setReferralData] = useState<ReferralData | null>(null);

  // 加载返佣数据
  useEffect(() => {
    const fetchReferralData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch("/api/profile/referrals");
        const result = await response.json();

        if (result.success && result.data) {
          setReferralData(result.data);
        } else {
          setError(result.error || "加载数据失败");
        }
      } catch (err) {
        console.error("Failed to fetch referral data:", err);
        setError("加载数据失败");
      } finally {
        setIsLoading(false);
      }
    };

    fetchReferralData();
  }, []);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-pm-green mr-2" />
        <span className="text-pm-text-dim">{t('category.loading')}</span>
      </div>
    );
  }

  if (error || !referralData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <p className="text-red-500 font-medium mb-2">{error || "加载失败"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 顶部卡片：邀请码和邀请链接 */}
      <div className="bg-[#0F111A] rounded-xl border border-pm-border p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 邀请码 */}
          <div>
            <label className="block text-sm font-medium text-pm-text-dim mb-2">
              {t('profile.referral.my_code')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={referralData.referralCode || ""}
                readOnly
                className="flex-1 bg-pm-card border border-pm-border rounded-lg px-4 py-3 text-white font-mono"
              />
              <button
                onClick={() => handleCopy(referralData.referralCode)}
                className="px-4 py-3 bg-pm-green hover:bg-green-400 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{t('profile.referral.copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>{t('profile.referral.copy')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 邀请链接 */}
          <div>
            <label className="block text-sm font-medium text-pm-text-dim mb-2">
              {t('profile.referral.link')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={referralData.referralLink}
                readOnly
                className="flex-1 bg-pm-card border border-pm-border rounded-lg px-4 py-3 text-white text-sm truncate"
              />
              <button
                onClick={() => handleCopy(referralData.referralLink)}
                className="px-4 py-3 bg-pm-green hover:bg-green-400 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{t('profile.referral.copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>{t('profile.referral.copy')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 数据看板：三个指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0F111A] rounded-xl border border-pm-border p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-pm-green" />
            <span className="text-sm text-pm-text-dim uppercase tracking-wider">{t('profile.referral.invited_count')}</span>
          </div>
          <div className="text-3xl font-bold text-white">{referralData.invitedCount}</div>
        </div>

        <div className="bg-[#0F111A] rounded-xl border border-pm-border p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 text-pm-green" />
            <span className="text-sm text-pm-text-dim uppercase tracking-wider">{t('profile.referral.total_earnings')}</span>
          </div>
          <div className="text-3xl font-bold text-pm-green">{formatUSD(referralData.totalEarnings)}</div>
        </div>

        <div className="bg-[#0F111A] rounded-xl border border-pm-border p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-pm-green" />
            <span className="text-sm text-pm-text-dim uppercase tracking-wider">{t('profile.referral.pending_earnings')}</span>
          </div>
          <div className="text-3xl font-bold text-white">{formatUSD(0)}</div>
        </div>
      </div>

      {/* 详情列表：受邀用户表格 */}
      <div className="bg-[#0F111A] rounded-xl border border-pm-border overflow-hidden">
        <div className="p-6 border-b border-pm-border">
          <h3 className="text-lg font-bold text-white">{t('profile.referral.referred_users')}</h3>
        </div>
        <div className="overflow-x-auto">
          {referralData.referredUsers.length > 0 ? (
            <table className="w-full">
              <thead className="bg-pm-card border-b border-pm-border">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-pm-text-dim uppercase tracking-wider">
                    {t('profile.referral.user')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-pm-text-dim uppercase tracking-wider">
                    {t('profile.referral.registered_at')}
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-pm-text-dim uppercase tracking-wider">
                    {t('profile.referral.contribution')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pm-border">
                {referralData.referredUsers.map((referral) => (
                  <tr key={referral.id} className="hover:bg-pm-card transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-pm-text-dim" />
                        <span className="text-white font-medium">{referral.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-pm-text-dim text-sm">
                      {new Date(referral.registeredAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-pm-green font-bold">{formatUSD(referral.contribution)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-pm-text-dim mx-auto mb-4" />
              <p className="text-pm-text-dim">暂无受邀用户</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
