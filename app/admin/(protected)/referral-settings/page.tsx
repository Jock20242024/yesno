"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function ReferralSettingsPage() {
  const [ratePercent, setRatePercent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 加载当前配置
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/admin/settings/referral");
        const result = await response.json();

        if (result.success && result.data) {
          setRatePercent(result.data.ratePercent.toString());
        } else {
          toast.error("加载设置失败");
        }
      } catch (error) {
        console.error("Failed to fetch referral settings:", error);
        toast.error("加载设置失败");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    const rate = parseFloat(ratePercent);
    
    // 验证输入
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error("返佣比例必须在 0-100 之间");
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch("/api/admin/settings/referral", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ratePercent: rate }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("返佣设置保存成功");
      } else {
        toast.error(result.error || "保存失败");
      }
    } catch (error) {
      console.error("Failed to save referral settings:", error);
      toast.error("保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] flex flex-col gap-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-[#111418] dark:text-white">返佣设置</h1>
        <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">
          配置用户交易量返佣比例
        </p>
      </div>

      {/* 设置表单 */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6 md:p-8">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-[#111418] dark:text-white mb-4">
              交易量返佣比例
            </h3>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="ratePercent"
                  className="block text-sm font-medium text-[#111418] dark:text-white mb-2"
                >
                  返佣比例 (%) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="ratePercent"
                    name="ratePercent"
                    value={ratePercent}
                    onChange={(e) => setRatePercent(e.target.value)}
                    disabled={isLoading}
                    min="0"
                    max="100"
                    step="0.01"
                    className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="例如：1.0 (代表 1%)"
                  />
                  <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#637588] dark:text-[#9da8b9] text-sm">
                    %
                  </span>
                </div>
                <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">
                  设置基于交易量计算的返佣比例。例如：输入 5 表示 5%，即用户交易 100 USDT，邀请人获得 5 USDT 返佣。
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleSave}
                  disabled={isLoading || isSaving}
                  className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? "保存中..." : "保存设置"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

