"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import StatsCards from "./components/StatsCards";
import TemplateList from "./components/TemplateList";
import CreateTemplateModal from "./components/CreateTemplateModal";
import FactoryMarketsTab from "./components/FactoryMarketsTab";

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
  healthStatus?: 'HEALTHY' | 'GAP'; // 🚀 第一步：健康度状态
}

interface FactoryStats {
  activeTemplates: number;
  todayGenerated: number;
  pausedTemplates: number;
  totalTemplates: number;
  lastFactoryRunAt?: string | null; // 🔥 修复：添加心跳字段
}

export default function FactoryPage() {
  const [templates, setTemplates] = useState<MarketTemplate[]>([]);
  const [stats, setStats] = useState<FactoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  // 🚀 第二步：添加 Tabs 状态
  const [activeTab, setActiveTab] = useState<'templates' | 'markets'>('templates');
  // 🔥 移除 harvest 相关状态

  // 获取模板列表和统计数据
  useEffect(() => {
    fetchTemplates();
    fetchStats();
    
    // 每 3 秒刷新一次统计数据
    const statsInterval = setInterval(fetchStats, 3000);
    return () => clearInterval(statsInterval);
  }, []);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/factory/templates", {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      console.error("获取模板列表失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setIsLoadingStats(true);
      const response = await fetch("/api/admin/factory/stats", {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error("获取统计数据失败:", error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleTriggerGeneration = async (templateId: string) => {
    if (!confirm('确定要立即触发生成下期市场吗？')) {
      return;
    }

    setTriggeringId(templateId);
    try {
      const response = await fetch(`/api/admin/factory/templates/${templateId}/trigger`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        toast.success('市场生成成功！');
        fetchTemplates();
        fetchStats();
      } else {
        toast.error(`生成失败: ${data.error}`);
      }
    } catch (error) {
      console.error("触发生成失败:", error);
      toast.error("触发生成失败");
    } finally {
      setTriggeringId(null);
    }
  };

  const handleModalSuccess = () => {
    fetchTemplates();
    fetchStats();
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const newActiveState = !currentActive;
      const response = await fetch(`/api/admin/factory/templates/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ isActive: newActiveState }),
      });

      const data = await response.json();
      if (data.success) {
        fetchTemplates();
        fetchStats();
      } else {
        toast.error(data.error || "更新模板状态失败");
      }
    } catch (error) {
      console.error("更新模板状态失败:", error);
      toast.error("更新模板状态失败");
    }
  };

  // 🔥 移除 handleHarvestTemplates 函数（物理删除 harvest 功能）

  return (
    <div className="mx-auto max-w-[1400px] flex flex-col gap-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111418] dark:text-white">自动化工厂 (Market Factory)</h1>
          <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">批量创建和管理预测市场的自动化工具</p>
        </div>
      </div>

      {/* 🚀 第二步：Tabs 导航 */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm">
        <div className="flex border-b border-[#e5e7eb] dark:border-[#283545]">
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'templates'
                ? 'text-primary border-b-2 border-primary bg-primary/5 dark:bg-primary/10'
                : 'text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white hover:bg-[#f9fafb] dark:hover:bg-[#1e2a36]'
            }`}
          >
            模板列表
          </button>
          <button
            onClick={() => setActiveTab('markets')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'markets'
                ? 'text-primary border-b-2 border-primary bg-primary/5 dark:bg-primary/10'
                : 'text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white hover:bg-[#f9fafb] dark:hover:bg-[#1e2a36]'
            }`}
          >
            工厂市场列表
          </button>
        </div>

        {/* Tab 内容 */}
        <div className="p-6">
          {activeTab === 'templates' ? (
            <>
              {/* 工厂运行状态监控卡片组 */}
              <div className="mb-6">
                <StatsCards stats={stats} isLoadingStats={isLoadingStats} templates={templates} />
              </div>

              {/* 模板列表 */}
              <TemplateList
                templates={templates}
                isLoading={isLoading}
                triggeringId={triggeringId}
                onTriggerGeneration={handleTriggerGeneration}
                onToggleActive={handleToggleActive}
                onCreateTemplate={() => setIsCreateModalOpen(true)}
                onRefresh={fetchTemplates}
              />
            </>
          ) : (
            /* 🚀 第二步：工厂市场列表 - 使用独立组件，传入 source='factory' */
            <FactoryMarketsTab />
          )}
        </div>
      </div>

      {/* 创建模板 Dialog */}
      <CreateTemplateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
