"use client";

import { useState } from "react";
import { Copy, Check, Users, DollarSign, Clock, User } from "lucide-react";
import { formatUSD } from "@/lib/utils";

export default function ReferralTab() {
  const [copied, setCopied] = useState(false);
  const referralCode = "REF2025ABC"; // Mock 数据
  const referralLink = `https://yesno-app.com/register?ref=${referralCode}`;
  
  // Mock 数据
  const invitedCount = 12;
  const totalRewards = 1250.50;
  const pendingRewards = 350.00;
  
  // Mock 受邀用户列表
  const referrals = [
    { id: "1", username: "用户A", registeredAt: "2025-01-15", contribution: 250.00 },
    { id: "2", username: "用户B", registeredAt: "2025-01-20", contribution: 180.50 },
    { id: "3", username: "用户C", registeredAt: "2025-02-01", contribution: 320.00 },
  ];

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 顶部卡片：邀请码和邀请链接 */}
      <div className="bg-[#0F111A] rounded-xl border border-pm-border p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 邀请码 */}
          <div>
            <label className="block text-sm font-medium text-pm-text-dim mb-2">
              您的邀请码
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={referralCode}
                readOnly
                className="flex-1 bg-pm-card border border-pm-border rounded-lg px-4 py-3 text-white font-mono"
              />
              <button
                onClick={() => handleCopy(referralCode)}
                className="px-4 py-3 bg-pm-green hover:bg-green-400 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>复制</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 邀请链接 */}
          <div>
            <label className="block text-sm font-medium text-pm-text-dim mb-2">
              邀请链接
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={referralLink}
                readOnly
                className="flex-1 bg-pm-card border border-pm-border rounded-lg px-4 py-3 text-white text-sm truncate"
              />
              <button
                onClick={() => handleCopy(referralLink)}
                className="px-4 py-3 bg-pm-green hover:bg-green-400 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>复制</span>
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
            <span className="text-sm text-pm-text-dim uppercase tracking-wider">已邀请人数</span>
          </div>
          <div className="text-3xl font-bold text-white">{invitedCount}</div>
        </div>

        <div className="bg-[#0F111A] rounded-xl border border-pm-border p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 text-pm-green" />
            <span className="text-sm text-pm-text-dim uppercase tracking-wider">总返佣收益</span>
          </div>
          <div className="text-3xl font-bold text-pm-green">{formatUSD(totalRewards)}</div>
        </div>

        <div className="bg-[#0F111A] rounded-xl border border-pm-border p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-pm-green" />
            <span className="text-sm text-pm-text-dim uppercase tracking-wider">预计到账</span>
          </div>
          <div className="text-3xl font-bold text-white">{formatUSD(pendingRewards)}</div>
        </div>
      </div>

      {/* 详情列表：受邀用户表格 */}
      <div className="bg-[#0F111A] rounded-xl border border-pm-border overflow-hidden">
        <div className="p-6 border-b border-pm-border">
          <h3 className="text-lg font-bold text-white">受邀用户</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-pm-card border-b border-pm-border">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-pm-text-dim uppercase tracking-wider">
                  受邀用户
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-pm-text-dim uppercase tracking-wider">
                  注册时间
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-pm-text-dim uppercase tracking-wider">
                  贡献收益
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pm-border">
              {referrals.map((referral) => (
                <tr key={referral.id} className="hover:bg-pm-card transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-pm-text-dim" />
                      <span className="text-white font-medium">{referral.username}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-pm-text-dim text-sm">
                    {referral.registeredAt}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-pm-green font-bold">{formatUSD(referral.contribution)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
