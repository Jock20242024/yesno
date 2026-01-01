"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Play, Pause, Download, Languages, X } from "lucide-react";

interface MarketTemplate {
  id: string;
  name: string;
  nameZh?: string | null; // 🔥 中文名称（人工翻译）
  symbol: string;
  period: number;
  advanceTime: number;
  oracleUrl?: string | null;
  isActive: boolean;
  status?: string;
  failureCount?: number;
  pauseReason?: string | null;
  lastMarketId?: string | null;
  lastCreatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TemplateListProps {
  templates: MarketTemplate[];
  isLoading: boolean;
  triggeringId: string | null;
  onTriggerGeneration: (templateId: string) => void;
  onToggleActive: (id: string, currentActive: boolean) => void;
  onCreateTemplate: () => void;
  onRefresh?: () => void; // 🔥 刷新列表回调
}

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString("zh-CN");
};

export default function TemplateList({
  templates,
  isLoading,
  triggeringId,
  onTriggerGeneration,
  onToggleActive,
  onCreateTemplate,
  onRefresh,
}: TemplateListProps) {
  const router = useRouter();
  const [translatingTemplate, setTranslatingTemplate] = useState<MarketTemplate | null>(null);
  const [translationText, setTranslationText] = useState("");
  const [isSavingTranslation, setIsSavingTranslation] = useState(false);

  const handleOpenTranslation = (template: MarketTemplate) => {
    setTranslatingTemplate(template);
    setTranslationText(template.nameZh || "");
  };

  const handleCloseTranslation = () => {
    setTranslatingTemplate(null);
    setTranslationText("");
  };

  const handleSaveTranslation = async () => {
    if (!translatingTemplate) return;

    setIsSavingTranslation(true);
    try {
      const response = await fetch(`/api/admin/factory/templates/${translatingTemplate.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: translatingTemplate.name,
          nameZh: translationText.trim() || null,
          symbol: translatingTemplate.symbol,
          period: translatingTemplate.period,
          advanceTime: translatingTemplate.advanceTime,
          oracleUrl: translatingTemplate.oracleUrl,
          isActive: translatingTemplate.isActive,
        }),
      });

      const data = await response.json();
      if (data.success) {
        handleCloseTranslation();
        if (onRefresh) {
          onRefresh();
        }
      } else {
        toast.error(data.error || "保存翻译失败");
      }
    } catch (error) {
      console.error("保存翻译失败:", error);
      toast.error("保存翻译失败");
    } finally {
      setIsSavingTranslation(false);
    }
  };

  return (
    <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#111418] dark:text-white">模板列表</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={onCreateTemplate}
              className="flex items-center gap-2 px-4 py-2 border border-[#d1d5db] dark:border-[#3e4e63] bg-white dark:bg-[#101822] hover:bg-[#f3f4f6] dark:hover:bg-[#1a2332] text-[#111418] dark:text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              新建模板
            </button>
            {/* 🔥 物理移除"从 Polymarket 抓取标准模版"按钮 */}
          </div>
        </div>
        
        {isLoading ? (
          <div className="text-center py-8 text-[#637588] dark:text-[#9da8b9]">加载中...</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-[#637588] dark:text-[#9da8b9]">
            暂无模板，点击"新建模板"创建
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e5e7eb] dark:border-[#283545]">
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#111418] dark:text-white">名称</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#111418] dark:text-white">标的</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#111418] dark:text-white">周期</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#111418] dark:text-white">接力时间</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#111418] dark:text-white">状态</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#111418] dark:text-white">失败计数</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#111418] dark:text-white">最后创建</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#111418] dark:text-white">操作</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => {
                  const status = template.status || (template.isActive ? 'ACTIVE' : 'PAUSED');
                  const isPaused = status === 'PAUSED';
                  const failureCount = template.failureCount || 0;
                  
                  return (
                    <tr 
                      key={template.id} 
                      className={`border-b border-[#e5e7eb] dark:border-[#283545] hover:bg-[#f9fafb] dark:hover:bg-[#1a2332] ${
                        isPaused ? 'bg-red-50 dark:bg-red-900/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-sm text-[#111418] dark:text-white">
                        {template.nameZh || template.name}
                      </td>
                      <td className="py-3 px-4 text-sm text-[#111418] dark:text-white">{template.symbol}</td>
                      <td className="py-3 px-4 text-sm text-[#111418] dark:text-white">{template.period} 分钟</td>
                      <td className="py-3 px-4 text-sm text-[#111418] dark:text-white">{template.advanceTime} 秒</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          isPaused
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : template.isActive 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                        }`}>
                          {isPaused ? '已熔断' : template.isActive ? '激活' : '停用'}
                        </span>
                        {isPaused && template.pauseReason && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{template.pauseReason}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-[#111418] dark:text-white">
                        {failureCount > 0 && (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            failureCount >= 3
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}>
                            {failureCount}/3
                          </span>
                        )}
                        {failureCount === 0 && <span className="text-[#637588] dark:text-[#9da8b9]">0</span>}
                      </td>
                      <td className="py-3 px-4 text-sm text-[#637588] dark:text-[#9da8b9]">
                        {formatDate(template.lastCreatedAt)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onTriggerGeneration(template.id)}
                            disabled={triggeringId === template.id || isPaused}
                            className="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            title={isPaused ? '模版已熔断，无法生成' : '立即生成下期'}
                          >
                            {triggeringId === template.id ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                <span>生成中...</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3" />
                                <span>立即生成</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => router.push(`/admin/factory/templates/${template.id}/edit`)}
                            className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                            title="编辑模版（设置行权价偏移量）"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => handleOpenTranslation(template)}
                            className="text-[#637588] dark:text-[#9da8b9] hover:text-primary transition-colors"
                            title="翻译"
                          >
                            <Languages className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onToggleActive(template.id, template.isActive)}
                            className="text-[#637588] dark:text-[#9da8b9] hover:text-primary transition-colors"
                            title={template.isActive ? '暂停' : '激活'}
                          >
                            {template.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 翻译对话框 */}
      {translatingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1a2332] rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#111418] dark:text-white">翻译模板名称</h3>
              <button
                onClick={handleCloseTranslation}
                className="text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-2">
                原始名称
              </label>
              <div className="px-3 py-2 bg-[#f3f4f6] dark:bg-[#283545] rounded-lg text-[#111418] dark:text-white">
                {translatingTemplate.name}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-2">
                中文名称
              </label>
              <input
                type="text"
                value={translationText}
                onChange={(e) => setTranslationText(e.target.value)}
                className="w-full px-3 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="请输入中文名称（留空则显示原始名称）"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isSavingTranslation && translationText.trim()) {
                    handleSaveTranslation();
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handleCloseTranslation}
                disabled={isSavingTranslation}
                className="px-4 py-2 border border-[#d1d5db] dark:border-[#3e4e63] bg-white dark:bg-[#101822] text-[#111418] dark:text-white rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#1a2332] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                取消
              </button>
              <button
                onClick={handleSaveTranslation}
                disabled={isSavingTranslation}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSavingTranslation ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>保存中...</span>
                  </>
                ) : (
                  <span>保存</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
