"use client";

import { useState, useEffect } from "react";
import { Key, Plus, Trash2, AlertCircle, Copy, Check, Loader2, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import useSWR from "swr";
import { toast } from "sonner";

interface ApiKey {
  id: string;
  label: string;
  keyPrefix: string;
  maskedKey: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface ApiKeyResponse {
  success: boolean;
  data?: ApiKey[];
  error?: string;
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data: ApiKeyResponse = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch API keys');
  }
  return data.data || [];
};

export default function ApiManagementTab() {
  const { t } = useLanguage();
  const [copied, setCopied] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  // 使用 SWR 加载 API Keys 列表
  const { data: apiKeys = [], error, isLoading, mutate } = useSWR<ApiKey[]>('/api/user/api-keys', fetcher);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
      toast.success(t('profile.referral.copied'));
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error("复制失败");
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyLabel.trim()) {
      toast.error("请输入 Key 名称");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/user/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ label: newKeyLabel.trim() }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        // 显示完整 Key
        setNewlyCreatedKey(result.data.fullKey);
        setNewKeyLabel("");
        setShowCreateModal(false);
        
        // 刷新列表
        mutate();
        
        toast.success("API Key 创建成功！请立即复制保存。");
      } else {
        toast.error(result.error || "创建失败");
      }
    } catch (error) {
      console.error("Failed to create API key:", error);
      toast.error("创建失败，请稍后重试");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm(t('profile.api.delete_confirm'))) {
      return;
    }

    try {
      const response = await fetch("/api/user/api-keys", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("API Key 已删除");
        mutate(); // 刷新列表
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch (error) {
      console.error("Failed to delete API key:", error);
      toast.error("删除失败，请稍后重试");
    }
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 说明区 */}
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-yellow-400 font-medium mb-1">{t('profile.api.security_warning')}</div>
          <div className="text-sm text-pm-text-dim">
            {t('profile.api.security_desc')}
          </div>
        </div>
      </div>

      {/* 操作区 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">{t('profile.api.title')}</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          {t('profile.api.create')}
        </button>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-pm-green mr-2" />
          <span className="text-pm-text-dim">加载中...</span>
        </div>
      )}

      {/* 错误状态 */}
      {error && !isLoading && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">
          加载失败: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {/* 列表区 */}
      {!isLoading && !error && (
        <>
          {apiKeys.length === 0 ? (
            <div className="bg-[#0F111A] rounded-xl border border-pm-border p-12 text-center">
              <Key className="w-12 h-12 text-pm-text-dim mx-auto mb-4" />
              <p className="text-pm-text-dim">{t('profile.api.empty')}</p>
              <p className="text-sm text-pm-text-dim mt-2">{t('profile.api.empty_desc')}</p>
            </div>
          ) : (
            <div className="bg-[#0F111A] rounded-xl border border-pm-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-pm-card border-b border-pm-border">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-pm-text-dim uppercase tracking-wider">
                        {t('profile.api.key_name')}
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-pm-text-dim uppercase tracking-wider">
                        {t('profile.api.created_at')}
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-pm-text-dim uppercase tracking-wider">
                        {t('profile.api.api_key')}
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-medium text-pm-text-dim uppercase tracking-wider">
                        {t('profile.api.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pm-border">
                    {apiKeys.map((apiKey) => (
                      <tr key={apiKey.id} className="hover:bg-pm-card transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-white font-medium">{apiKey.label}</div>
                        </td>
                        <td className="px-6 py-4 text-pm-text-dim text-sm">
                          {formatDate(apiKey.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <code className="text-sm text-pm-text-dim font-mono bg-pm-card px-2 py-1 rounded">
                              {apiKey.maskedKey}
                            </code>
                            <button
                              onClick={() => handleCopy(apiKey.maskedKey, apiKey.id)}
                              className="p-1 hover:bg-pm-card rounded transition-colors"
                              title={t('profile.api.copy')}
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
                            {t('profile.api.delete')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* 创建 Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0F111A] rounded-xl border border-pm-border p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">{t('profile.api.create')}</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-pm-text-dim hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  {t('profile.api.key_name')}
                </label>
                <input
                  type="text"
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder="例如: 交易机器人"
                  className="w-full px-4 py-2 bg-pm-card border border-pm-border rounded-lg text-white placeholder-pm-text-dim focus:outline-none focus:border-primary"
                  disabled={isCreating}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCreateKey}
                  disabled={isCreating || !newKeyLabel.trim()}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
                >
                  {isCreating ? "创建中..." : "创建"}
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreating}
                  className="px-4 py-2 bg-pm-card hover:bg-pm-card-hover disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 显示完整 Key Modal（仅显示一次） */}
      {newlyCreatedKey && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0F111A] rounded-xl border border-red-500/50 p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-red-500">⚠️ 请立即复制保存</h3>
              <button
                onClick={() => setNewlyCreatedKey(null)}
                className="text-pm-text-dim hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-red-400 text-sm font-medium mb-2">
                  此 Key 只显示一次，关闭后将无法再次查看！
                </p>
                <p className="text-pm-text-dim text-sm">
                  请立即复制并安全保存。如果丢失，您需要删除此 Key 并重新创建。
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  您的 API Key:
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-4 py-3 bg-pm-card border border-pm-border rounded-lg text-white font-mono text-sm break-all">
                    {newlyCreatedKey}
                  </code>
                  <button
                    onClick={() => handleCopy(newlyCreatedKey, 'new-key')}
                    className="px-4 py-3 bg-blue-500 hover:bg-blue-400 text-white rounded-lg transition-colors"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <button
                onClick={() => setNewlyCreatedKey(null)}
                className="w-full px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors font-medium"
              >
                我已保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
