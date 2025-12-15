"use client";

import { Key } from "lucide-react";

export default function ApiManagementTab() {
  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
        <Key className="w-5 h-5" />
        API 管理
      </h2>
      <div className="bg-pm-bg rounded-xl border border-pm-border p-8 text-center">
        <div className="text-4xl mb-4">🔑</div>
        <p className="text-pm-text-dim text-lg">功能开发中...</p>
        <p className="text-pm-text-dim text-sm mt-2">
          创建和管理您的 API 密钥，用于程序化交易
        </p>
      </div>
    </div>
  );
}

