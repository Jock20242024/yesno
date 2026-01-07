"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<"commission" | "security">("commission");
  const [commissionRate, setCommissionRate] = useState("");
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 🔥 新增：加载全局手续费率
  useEffect(() => {
    const loadGlobalFeeRate = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/admin/settings/global-fee-rate');
        const result = await response.json();
        if (result.success && result.data?.feeRate !== undefined) {
          // 转换为百分比显示（例如：0.05 -> 5）
          setCommissionRate((result.data.feeRate * 100).toFixed(2));
        }
      } catch (error) {
        console.error('❌ [Settings] 加载全局手续费率失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (activeTab === "commission") {
      loadGlobalFeeRate();
    }
  }, [activeTab]);

  // 🔥 新增：保存全局手续费率
  const handleSaveSettings = async () => {
    if (!commissionRate || isNaN(parseFloat(commissionRate))) {
      toast.error('请输入有效的手续费率');
      return;
    }

    const feeRateNum = parseFloat(commissionRate);
    if (feeRateNum < 0 || feeRateNum > 100) {
      toast.error('手续费率必须在 0% 到 100% 之间');
      return;
    }

    try {
      setIsSaving(true);
      // 转换为小数（例如：5 -> 0.05）
      const feeRateDecimal = feeRateNum / 100;
      
      const response = await fetch('/api/admin/settings/global-fee-rate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feeRate: feeRateDecimal }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success('设置已保存', {
          description: `全局手续费率已设置为 ${feeRateNum}%`,
        });
      } else {
        toast.error('保存失败', {
          description: result.error || '未知错误',
        });
      }
    } catch (error: any) {
      console.error('❌ [Settings] 保存全局手续费率失败:', error);
      toast.error('保存失败', {
        description: error.message || '网络错误',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 🔥 新增：重置为默认值
  const handleReset = () => {
    setCommissionRate('5.00'); // 默认 5%
  };

  return (
    <div className="mx-auto max-w-[1200px] flex flex-col gap-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-[#111418] dark:text-white">系统设置</h1>
        <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">配置系统参数和安全设置</p>
      </div>

      {/* Tab 切换容器 */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm flex flex-col">
        {/* Tab 导航 */}
        <div className="flex border-b border-[#e5e7eb] dark:border-[#283545]">
          <button
            onClick={() => setActiveTab("commission")}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "commission"
                ? "border-primary text-primary"
                : "border-transparent text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
            }`}
          >
            佣金配置
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "security"
                ? "border-primary text-primary"
                : "border-transparent text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white"
            }`}
          >
            安全设置
          </button>
        </div>

        {/* Tab 内容 */}
        <div className="p-6 md:p-8">
          {/* Tab 1: 佣金配置 */}
          {activeTab === "commission" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-[#111418] dark:text-white mb-4">佣金配置</h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="commissionRate" className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
                      全局佣金比例 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        id="commissionRate"
                        name="commissionRate"
                        value={commissionRate}
                        onChange={(e) => setCommissionRate(e.target.value)}
                        min="0"
                        max="100"
                        step="0.01"
                        disabled={isLoading}
                        className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder={isLoading ? "加载中..." : "例如：2.5"}
                      />
                      <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#637588] dark:text-[#9da8b9] text-sm">%</span>
                    </div>
                    <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">
                      设置平台从每笔交易中收取的全局手续费比例。如果市场创建时未指定手续费率，将使用此全局设置。
                    </p>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={handleSaveSettings}
                      disabled={isSaving || isLoading}
                      className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? '保存中...' : '保存设置'}
                    </button>
                    <button 
                      onClick={handleReset}
                      disabled={isSaving || isLoading}
                      className="px-6 py-3 bg-white dark:bg-[#101822] border border-[#d1d5db] dark:border-[#3e4e63] text-[#111418] dark:text-white rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#283545] transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      重置
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: 安全设置 */}
          {activeTab === "security" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-[#111418] dark:text-white mb-4">安全设置</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-[#e5e7eb] dark:border-[#283545] bg-[#f9fafb] dark:bg-[#101822]">
                    <div className="flex flex-col">
                      <label htmlFor="twoFactorRequired" className="text-sm font-medium text-[#111418] dark:text-white mb-1">
                        双因素认证要求
                      </label>
                      <p className="text-xs text-[#637588] dark:text-[#9da8b9]">要求所有管理员账户启用双因素认证（占位符）</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        id="twoFactorRequired"
                        checked={twoFactorRequired}
                        onChange={(e) => setTwoFactorRequired(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm text-sm font-medium">
                      保存设置
                    </button>
                    <button className="px-6 py-3 bg-white dark:bg-[#101822] border border-[#d1d5db] dark:border-[#3e4e63] text-[#111418] dark:text-white rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#283545] transition-colors text-sm font-medium">
                      重置
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

