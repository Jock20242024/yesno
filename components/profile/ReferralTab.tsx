"use client";

import { Users } from "lucide-react";

export default function ReferralTab() {
  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
        <Users className="w-5 h-5" />
        邀请返佣
      </h2>
      <div className="bg-pm-bg rounded-xl border border-pm-border p-8 text-center">
        <div className="text-4xl mb-4">🎁</div>
        <p className="text-pm-text-dim text-lg">功能开发中...</p>
        <p className="text-pm-text-dim text-sm mt-2">
          邀请好友注册，获得丰厚返佣奖励
        </p>
      </div>
    </div>
  );
}

