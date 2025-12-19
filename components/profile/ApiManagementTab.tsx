"use client";

import { useState } from "react";
import { Key, Plus, Trash2, AlertCircle, Copy, Check } from "lucide-react";

export default function ApiManagementTab() {
  const [copied, setCopied] = useState<string | null>(null);
  
  // Mock API Keys 数据
  const [apiKeys, setApiKeys] = useState([
    { id: "1", name: "交易机器人 v1", createdAt: "2025-01-10", key: "sk_live_abc123def456..." },
    { id: "2", name: "数据分析工具", createdAt: "2025-02-05", key: "sk_live_xyz789ghi012..." },
  ]);

  const handleCopy = async (key: string, id: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleCreateKey = () => {
    // TODO: 实现创建API Key的逻辑
    const newKey = {
      id: String(Date.now()),
      name: `新 API Key ${apiKeys.length + 1}`,
      createdAt: new Date().toISOString().split("T")[0],
      key: `sk_live_new${Math.random().toString(36).substring(7)}...`,
    };
    setApiKeys([...apiKeys, newKey]);
  };

  const handleDeleteKey = (id: string) => {
    if (confirm("确定要删除这个 API Key 吗？此操作不可恢复。")) {
      setApiKeys(apiKeys.filter((key) => key.id !== id));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 说明区 */}
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-yellow-400 font-medium mb-1">安全提示</div>
          <div className="text-sm text-pm-text-dim">
            请勿泄露您的 API Key。API Key 具有完整账户访问权限，请妥善保管。
          </div>
        </div>
      </div>

      {/* 操作区 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">API Keys</h3>
        <button
          onClick={handleCreateKey}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          创建新 API Key
        </button>
      </div>

      {/* 列表区 */}
      {apiKeys.length === 0 ? (
        <div className="bg-[#0F111A] rounded-xl border border-pm-border p-12 text-center">
          <Key className="w-12 h-12 text-pm-text-dim mx-auto mb-4" />
          <p className="text-pm-text-dim">暂无 API Keys</p>
          <p className="text-sm text-pm-text-dim mt-2">点击上方按钮创建您的第一个 API Key</p>
        </div>
      ) : (
        <div className="bg-[#0F111A] rounded-xl border border-pm-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-pm-card border-b border-pm-border">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-pm-text-dim uppercase tracking-wider">
                    Key 名称
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-pm-text-dim uppercase tracking-wider">
                    创建时间
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-pm-text-dim uppercase tracking-wider">
                    API Key
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-pm-text-dim uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pm-border">
                {apiKeys.map((apiKey) => (
                  <tr key={apiKey.id} className="hover:bg-pm-card transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-white font-medium">{apiKey.name}</div>
                    </td>
                    <td className="px-6 py-4 text-pm-text-dim text-sm">
                      {apiKey.createdAt}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-pm-text-dim font-mono bg-pm-card px-2 py-1 rounded">
                          {apiKey.key}
                        </code>
                        <button
                          onClick={() => handleCopy(apiKey.key, apiKey.id)}
                          className="p-1 hover:bg-pm-card rounded transition-colors"
                          title="复制"
                        >
                          {copied === apiKey.id ? (
                            <Check className="w-4 h-4 text-pm-green" />
                          ) : (
                            <Copy className="w-4 h-4 text-pm-text-dim" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteKey(apiKey.id)}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm text-pm-red hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
