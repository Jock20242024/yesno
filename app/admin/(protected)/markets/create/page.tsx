"use client";

import { useState, useEffect } from "react";
import { DollarSign, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  displayOrder: number;
  status: string;
}

export default function MarketCreationPage() {
  const [formData, setFormData] = useState({
    marketName: "",
    categories: [] as string[], // 🔥 改为多选数组
    description: "",
    coverImageUrl: "",
    endDate: "",
    endTime: "",
    oracleUrl: "",
    resultOptions: "",
    strikePrice: "市场开启时实时价格", // 参考行权价
    initialPriceLeft: "50", // 左侧选项初始价
    initialLiquidity: "", // 平台启动资金
    feeRate: "0.05", // 默认手续费率 5%
    isHot: false, // 是否热门
  });
  
  const [categories, setCategories] = useState<Category[]>([]); // 🔥 统一从数据库读取，不使用硬编码
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  // 获取分类列表
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoadingCategories(true);
        const response = await fetch("/api/admin/categories", {
          credentials: 'include',
        });

        const data = await response.json();

        if (data.success && data.data) {
          // 🔥 统一从数据库读取分类，不使用硬编码的默认分类
          if (data.data.length > 0) {
            setCategories(data.data);

          } else {
            console.warn('⚠️ [CreateMarket] 数据库中没有分类数据，请先在后台创建分类');
            setCategories([]);
          }
        } else {
          console.error("❌ [CreateMarket] 获取分类列表失败:", data.error);
          setCategories([]);
        }
      } catch (error) {
        console.error("❌ [CreateMarket] 获取分类列表失败:", error);
        setCategories([]);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    // 🔥 处理 checkbox 类型（如 isHot）
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // 🔥 处理分类切换（多选）- 使用 categoryId 而不是 slug
  const handleCategoryToggle = (categoryId: string) => {
    setFormData((prev) => {
      const currentCategories = prev.categories || [];
      const isSelected = currentCategories.includes(categoryId);
      
      if (isSelected) {
        // 如果已选中，则移除
        return {
          ...prev,
          categories: currentCategories.filter((id) => id !== categoryId),
        };
      } else {
        // 如果未选中，则添加
        return {
          ...prev,
          categories: [...currentCategories, categoryId],
        };
      }
    });
  };

  // 计算右侧选项初始价（100 - 左侧值）
  const initialPriceRight = (() => {
    const leftValue = parseFloat(formData.initialPriceLeft) || 0;
    const rightValue = 100 - leftValue;
    return Math.max(0, Math.min(100, rightValue)).toFixed(2);
  })();

  // 计算距离结束时间的倒计时
  useEffect(() => {
    if (!formData.endDate || !formData.endTime) {
      setTimeRemaining("");
      return;
    }

    const updateCountdown = () => {
      try {
        const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
        const now = new Date();
        const diff = endDateTime.getTime() - now.getTime();

        if (diff <= 0) {
          setTimeRemaining("已过期");
          return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) {
          setTimeRemaining(`距离现在还有 ${days} 天 ${hours} 小时`);
        } else if (hours > 0) {
          setTimeRemaining(`距离现在还有 ${hours} 小时 ${minutes} 分钟`);
        } else {
          setTimeRemaining(`距离现在还有 ${minutes} 分钟`);
        }
      } catch (error) {
        setTimeRemaining("");
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // 每分钟更新一次

    return () => clearInterval(interval);
  }, [formData.endDate, formData.endTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 验证分类是否至少选择一个
    if (!formData.categories || formData.categories.length === 0) {
      toast.error("请至少选择一个分类");
      return;
    }

    try {
      // 将日期和时间合并为 ISO 8601 格式
      let endTime = "";
      if (formData.endDate && formData.endTime) {
        const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
        endTime = endDateTime.toISOString();
      } else if (formData.endDate) {
        // 如果没有时间，使用日期当天的 23:59:59
        endTime = new Date(`${formData.endDate}T23:59:59`).toISOString();
      }
      
      // 🔥 验证分类 ID 是否有效（确保都是数据库中的真实 UUID）
      const validCategoryIds = formData.categories.filter((categoryId: string) => {
        // 验证 categoryId 是否在 categories 列表中存在
        const existsInCategories = categories.some(cat => cat.id === categoryId);
        if (!existsInCategories) {
          console.warn(`⚠️ [CreateMarket] 无效的分类 ID: ${categoryId}`);
        }
        return existsInCategories;
      });

      if (validCategoryIds.length === 0) {
        toast.error("请至少选择一个有效的分类");
        return;
      }

      // 🔥 使用第一个分类的名称作为主分类（向后兼容 API）
      const selectedCategoryId = validCategoryIds[0];
      const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);
      const categoryName = selectedCategory ? selectedCategory.name : '';

      const response = await fetch("/api/admin/markets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include', // 🔥 修复：使用 credentials 自动发送 HttpOnly Cookie，而不是硬编码 Token
        body: JSON.stringify({
          title: formData.marketName,
          description: formData.description,
          category: categoryName, // 🔥 向后兼容：主分类名称
          categories: validCategoryIds, // 🔥 发送真实的分类 ID 数组（UUID）
          isHot: formData.isHot,
          endTime: endTime,
          imageUrl: formData.coverImageUrl || undefined,
          sourceUrl: formData.oracleUrl || undefined,
          feeRate: parseFloat(formData.feeRate) || 0.05,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // 重置表单
        setFormData({
          marketName: "",
          categories: [],
          description: "",
          coverImageUrl: "",
          endDate: "",
          endTime: "",
          oracleUrl: "",
          resultOptions: "",
          strikePrice: "市场开启时实时价格",
          initialPriceLeft: "50",
          initialLiquidity: "",
          feeRate: "0.05",
          isHot: false,
        });
        // 显示成功消息（可以使用 toast 或其他通知组件）
        toast.success("市场创建成功！");
      } else {
        toast.error(data.error || "创建市场失败");
      }
    } catch (error) {
      console.error("Create market error:", error);
      toast.error("创建市场失败");
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] flex flex-col gap-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-[#111418] dark:text-white">创建新市场</h1>
        <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">填写以下信息来创建一个新的预测市场</p>
      </div>

      {/* 表单容器 */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 市场名称 */}
          <div>
            <label htmlFor="marketName" className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              市场名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="marketName"
              name="marketName"
              value={formData.marketName}
              onChange={handleChange}
              className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
              placeholder="例如：2024年比特币会达到10万美元吗？"
              required
            />
          </div>

          {/* 分类选择 - 多选模式 */}
          <div>
            <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              分类 <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {isLoadingCategories ? (
                <div className="text-sm text-[#637588] dark:text-[#9da8b9]">加载分类中...</div>
              ) : (
                <div className="flex flex-wrap gap-3 p-4 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] min-h-[60px]">
                  {categories.map((cat) => {
                    const isSelected = formData.categories.includes(cat.id); // 🔥 使用 id 而不是 slug
                    return (
                      <label
                        key={cat.id}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-primary/20 border-primary text-primary dark:bg-primary/30 dark:border-primary dark:text-primary"
                            : "bg-[#f3f4f6] dark:bg-[#1a2332] border-[#d1d5db] dark:border-[#3e4e63] text-[#111418] dark:text-white hover:border-primary/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleCategoryToggle(cat.id)} // 🔥 使用 id 而不是 slug
                          className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary focus:ring-2"
                        />
                        <span className="text-sm font-medium">{cat.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-[#637588] dark:text-[#9da8b9]">
              可以同时选择多个分类，例如同时选择"热门"和"加密货币"
            </p>
            {formData.categories.length === 0 && (
              <p className="mt-1 text-xs text-red-500">请至少选择一个分类</p>
            )}
          </div>

          {/* 热门标记 */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="isHot"
                checked={formData.isHot}
                onChange={handleChange}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary focus:ring-2"
              />
              <span className="text-sm font-medium text-[#111418] dark:text-white">
                标记为热门市场
              </span>
            </label>
            <p className="mt-1 text-xs text-[#637588] dark:text-[#9da8b9] ml-6">
              热门市场会在首页和"热门"分类中优先显示
            </p>
          </div>

          {/* 封面图片 */}
          <div>
            <label htmlFor="coverImageUrl" className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              封面图片 URL
            </label>
            <input
              type="url"
              id="coverImageUrl"
              name="coverImageUrl"
              value={formData.coverImageUrl}
              onChange={handleChange}
              className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
              placeholder="https://example.com/image.jpg"
            />
            {formData.coverImageUrl && (
              <div className="mt-3">
                <p className="text-xs text-[#637588] dark:text-[#9da8b9] mb-2">预览：</p>
                <div className="border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg overflow-hidden bg-white dark:bg-[#101822]">
                  <img
                    src={formData.coverImageUrl}
                    alt="封面预览"
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect fill='%23ddd' width='400' height='200'/%3E%3Ctext fill='%23999' font-family='sans-serif' font-size='16' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3E图片加载失败%3C/text%3E%3C/svg%3E";
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 描述 */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              描述
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm resize-y"
              placeholder="详细描述这个预测市场的背景和相关信息..."
            />
          </div>

          {/* 结束日期与时间 */}
          <div>
            <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              结束日期与时间 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
                  required
                />
              </div>
              <div>
                <input
                  type="time"
                  id="endTime"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
                  required
                />
              </div>
            </div>
            {timeRemaining && (
              <p className="mt-2 text-sm text-primary dark:text-[#ec9c13] font-medium">
                {timeRemaining}
              </p>
            )}
            <p className="mt-1 text-xs text-[#637588] dark:text-[#9da8b9]">
              精确到分钟，用于确定市场结算时间
            </p>
          </div>

          {/* 结算来源 */}
          <div>
            <label htmlFor="oracleUrl" className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              结算来源 / 预言机链接
            </label>
            <input
              type="url"
              id="oracleUrl"
              name="oracleUrl"
              value={formData.oracleUrl}
              onChange={handleChange}
              className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
              placeholder="https://www.binance.com/price/bitcoin"
            />
            <p className="mt-1 text-xs text-[#637588] dark:text-[#9da8b9]">
              填写判定胜负的唯一权威证据链接
            </p>
          </div>

          {/* 结果选项 */}
          <div>
            <label htmlFor="resultOptions" className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              结果选项 <span className="text-red-500">*</span>
            </label>
            <select
              id="resultOptions"
              name="resultOptions"
              value={formData.resultOptions}
              onChange={handleChange}
              className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm appearance-none"
              required
            >
              <option value="">请选择结果选项</option>
              <option value="yes-no">YES / NO</option>
              <option value="up-down">UP / DOWN (涨/跌)</option>
              <option value="multiple">多选项</option>
            </select>
          </div>

          {/* 参考行权价 - 仅当选择 UP/DOWN 时显示 */}
          {formData.resultOptions === "up-down" && (
            <div>
              <label htmlFor="strikePrice" className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
                参考行权价
              </label>
              <input
                type="text"
                id="strikePrice"
                name="strikePrice"
                value={formData.strikePrice}
                onChange={handleChange}
                className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
                placeholder="市场开启时实时价格"
              />
              <p className="mt-1 text-xs text-[#637588] dark:text-[#9da8b9]">
                用于判断涨跌的参考价格基准，默认使用市场开启时的实时价格
              </p>
            </div>
          )}

          {/* 初始价格设置 */}
          <div>
            <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              初始价格设置
            </label>
            <div className="flex items-end gap-4">
              {/* 左侧选项初始价 */}
              <div className="flex-1">
                <label htmlFor="initialPriceLeft" className="block text-xs text-[#637588] dark:text-[#9da8b9] mb-1">
                  左侧选项初始价 (U)
                </label>
                <input
                  type="number"
                  id="initialPriceLeft"
                  name="initialPriceLeft"
                  value={formData.initialPriceLeft}
                  onChange={handleChange}
                  min="0"
                  max="100"
                  step="0.01"
                  className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
                  placeholder="50"
                />
              </div>

              {/* 等号/箭头分隔符 */}
              <div className="pb-2.5 flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-[#637588] dark:text-[#9da8b9]" />
              </div>

              {/* 右侧选项初始价（只读） */}
              <div className="flex-1">
                <label htmlFor="initialPriceRight" className="block text-xs text-[#637588] dark:text-[#9da8b9] mb-1">
                  右侧选项初始价 (U)
                </label>
                <input
                  type="text"
                  id="initialPriceRight"
                  value={initialPriceRight}
                  readOnly
                  className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-[#f3f4f6] dark:bg-[#1a2332] text-[#111418] dark:text-[#9da8b9] cursor-not-allowed sm:text-sm"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-[#637588] dark:text-[#9da8b9]">
              这代表了你对这个事件最初的"胜率"看法。50对50是最公平的，确保 Yes 和 No 的总价值永远等于 100。
            </p>
          </div>

          {/* 平台启动资金 */}
          <div>
            <label htmlFor="initialLiquidity" className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              平台启动资金 ($)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <DollarSign className="w-5 h-5 text-[#D4AF37] dark:text-[#ec9c13]" />
              </div>
              <input
                type="number"
                id="initialLiquidity"
                name="initialLiquidity"
                value={formData.initialLiquidity}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="block w-full pl-12 pr-4 py-2.5 border-2 border-[#D4AF37] dark:border-[#ec9c13] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] dark:focus:ring-[#ec9c13] focus:ring-opacity-50 sm:text-sm"
                placeholder="例如：10000"
              />
            </div>
            <p className="mt-2 text-xs text-[#637588] dark:text-[#9da8b9]">
              该金额将作为市场初期的流动性，确保首批用户能够顺利下单。这笔钱越多，市场的抗波动能力（深度）就越强。
            </p>
          </div>

          {/* 手续费率 */}
          <div>
            <label htmlFor="feeRate" className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
              手续费率 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                id="feeRate"
                name="feeRate"
                value={formData.feeRate}
                onChange={handleChange}
                min="0"
                max="1"
                step="0.01"
                className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
                placeholder="例如：0.05 表示 5%"
                required
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-[#637588] dark:text-[#9da8b9] text-sm">%</span>
              </div>
            </div>
            <p className="mt-1 text-xs text-[#637588] dark:text-[#9da8b9]">
              手续费率范围：0.00 - 1.00（例如：0.05 表示 5%）
            </p>
          </div>

          {/* 提交按钮 */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm text-sm font-medium flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add_business</span>
              创建市场
            </button>
            <button
              type="button"
              className="px-6 py-3 bg-white dark:bg-[#101822] border border-[#d1d5db] dark:border-[#3e4e63] text-[#111418] dark:text-white rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#283545] transition-colors text-sm font-medium"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
