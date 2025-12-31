"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMarketDetail } from "@/hooks/useAdminData";

export default function MarketEditPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const marketId = params.market_id as string;
  
  // 🚀 读取 backTo 参数（回程票）
  const backTo = searchParams.get('backTo') || '/admin/markets/list';

  // 获取市场详情
  const { market, isLoading, error } = useMarketDetail(marketId);

  // 表单状态
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    closingDate: "",
    image: "",
    externalId: "", // 🔥 添加 externalId 字段
    categoryIds: [] as string[], // 🔥 分类ID数组（多选）
    isHot: false, // 🔥 热门标记
    reviewStatus: "PENDING" as "PENDING" | "PUBLISHED" | "REJECTED", // 🔥 审核状态
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [allCategories, setAllCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // 🔥 强力修复：改用前端 /api/categories 接口来取分类数据
  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoadingCategories(true);
      try {
        const response = await fetch("/api/categories");
        const result = await response.json();
        // 🔥 处理 /api/categories 返回格式：{ success: true, data: [...] }
        const data = result.success && result.data ? result.data : (Array.isArray(result) ? result : []);
        if (Array.isArray(data) && data.length > 0) {
          // 🔥 绑定逻辑：确保绑定的是 category.id 而不是 slug
          // 扁平化处理：如果有 children，也要包含进去
          const allCats: Array<{ id: string; name: string; slug: string }> = [];
          data.forEach((cat: any) => {
            if (cat.id) {
              allCats.push({
                id: cat.id, // value 是 id
                name: cat.name, // label 是 name
                slug: cat.slug,
              });
            }
            // 如果有子分类，也添加进去
            if (cat.children && Array.isArray(cat.children)) {
              cat.children.forEach((child: any) => {
                if (child.id) {
                  allCats.push({
                    id: child.id,
                    name: child.name,
                    slug: child.slug,
                  });
                }
              });
            }
          });
          setAllCategories(allCats);
          console.log(`✅ [MarketEdit] 成功加载 ${allCats.length} 个分类（从 /api/categories）`);
        } else {
          console.error("❌ [MarketEdit] 分类 API 返回格式错误或无数据:", result);
        }
      } catch (error) {
        console.error("❌ [MarketEdit] 获取分类列表失败:", error);
      } finally {
        setIsLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  // 当市场数据加载完成后，填充表单
  useEffect(() => {
    if (market) {
      const marketCategories = (market as any).categories || [];
      setFormData({
        title: market.title || "",
        description: market.description || "",
        closingDate: market.endTime ? new Date(market.endTime).toISOString().slice(0, 16) : "",
        image: (market as any).image || "",
        externalId: (market as any).externalId || "", // 🔥 填充 externalId
        categoryIds: marketCategories.map((cat: any) => cat.id) || [], // 🔥 填充分类ID数组
        isHot: (market as any).isHot || false, // 🔥 填充热门标记
        reviewStatus: (market as any).reviewStatus || "PENDING", // 🔥 填充审核状态
      });
    }
  }, [market]);

  // 结算状态
  const [resolutionOutcome, setResolutionOutcome] = useState<"YES" | "NO" | "">("");
  const [isResolving, setIsResolving] = useState(false);

  // 处理表单输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // 处理分类多选变化
  const handleCategoryChange = (categoryId: string, checked: boolean) => {
    setFormData((prev) => {
      if (checked) {
        return {
          ...prev,
          categoryIds: [...prev.categoryIds, categoryId],
        };
      } else {
        return {
          ...prev,
          categoryIds: prev.categoryIds.filter(id => id !== categoryId),
        };
      }
    });
  };

  // 处理市场更新
  const handleUpdateMarket = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // 验证必填字段
    if (!formData.title.trim()) {
      alert("请输入市场标题");
      return;
    }

    setIsUpdating(true);
    try {
      // API 调用：发送 PUT 请求到更新 API
      // 🔥 修复：添加 credentials: 'include' 以传递 Session Cookie
      const response = await fetch(`/api/admin/markets/${marketId}`, {
        method: "PUT",
        credentials: 'include', // 🔥 关键：确保传递 Session Cookie
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim(),
          endTime: formData.closingDate ? new Date(formData.closingDate).toISOString() : undefined,
          image: formData.image.trim() || null,
          externalId: formData.externalId.trim() || null, // 🔥 添加 externalId 字段
          categoryIds: formData.categoryIds, // 🔥 分类ID数组
          isHot: formData.isHot, // 🔥 热门标记
          reviewStatus: formData.reviewStatus, // 🔥 审核状态
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "更新失败");
      }

      const result = await response.json();
      if (result.success) {
        // 成功反馈：显示成功通知并刷新页面
        alert("市场信息已成功更新");
        // 刷新页面以显示最新数据
        window.location.reload();
      } else {
        throw new Error(result.error || "更新失败");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "更新失败");
    } finally {
      setIsUpdating(false);
    }
  };

  // 处理市场结算
  const handleResolveMarket = async () => {
    // 验证是否选择了结算结果
    if (!resolutionOutcome) {
      alert("请选择结算结果");
      return;
    }

    // 确认对话框
    if (!confirm(`确定要将市场结算为 "${resolutionOutcome}" 吗？此操作不可撤销。`)) {
      return;
    }

    setIsResolving(true);
    try {
      // API 调用：发送 POST 请求到结算 API
      // 🔥 修复：移除 Authorization header，NextAuth 会自动处理认证（通过 Cookie）
      const response = await fetch(`/api/admin/resolve/${marketId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include', // 🔥 确保发送 Cookie
        body: JSON.stringify({
          resolutionOutcome: resolutionOutcome,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "结算失败");
      }

      const result = await response.json();
      if (result.success) {
        // 成功反馈：显示成功通知并重定向到市场列表页（使用 backTo 参数）
        alert(`市场已成功结算为 "${resolutionOutcome}"`);
        router.push(backTo);
      } else {
        throw new Error(result.error || "结算失败");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "结算失败");
    } finally {
      setIsResolving(false);
    }
  };

  // 格式化时间
  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 格式化金额
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="mx-auto max-w-[1400px] flex flex-col gap-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111418] dark:text-white">市场编辑与结算</h1>
          <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">查看市场详情并进行结算操作</p>
        </div>
        <button
          onClick={() => router.push(backTo)}
          className="px-4 py-2 bg-white dark:bg-[#101822] border border-[#d1d5db] dark:border-[#3e4e63] text-[#111418] dark:text-white rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#283545] transition-colors text-sm font-medium"
        >
          返回列表
        </button>
      </div>

      {/* 加载状态：显示空状态，不阻塞渲染 */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-[#637588] dark:text-[#9da8b9]">加载市场详情...</p>
          </div>
        </div>
      )}

      {/* 错误状态：显示空状态，不阻塞渲染 */}
      {(error || !market) && !isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <span className="material-symbols-outlined text-red-500" style={{ fontSize: 48 }}>
              error
            </span>
            <p className="text-red-500">{error || "市场不存在"}</p>
            <button
              onClick={() => router.push(backTo)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium mt-4"
            >
              返回市场列表
            </button>
          </div>
        </div>
      )}

      {/* 正常内容：只在有数据且不在加载时显示 */}
      {!isLoading && market && (
        <>
          {/* 两栏布局 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 左侧：市场基本信息 */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <form onSubmit={handleUpdateMarket} className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-[#111418] dark:text-white">市场基本信息</h2>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isUpdating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>更新中...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                          save
                        </span>
                        <span>保存更改</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="space-y-4">
              {/* 市场标题 */}
              <div>
                <label className="block text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-1">
                  市场标题 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="请输入市场标题"
                  required
                />
              </div>

              {/* 市场头像 URL */}
              <div>
                <label className="block text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-1">
                  头像 URL (image)
                </label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <input
                      type="url"
                      name="image"
                      value={formData.image}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="https://example.com/image.jpg"
                    />
                    <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">
                      输入市场头像的完整 URL 地址
                    </p>
                  </div>
                  {/* 图片预览 */}
                  {formData.image && (
                    <div className="flex-shrink-0">
                      <div className="w-24 h-24 rounded-lg border border-[#d1d5db] dark:border-[#3e4e63] overflow-hidden bg-[#f3f4f6] dark:bg-[#1a1f2e] flex items-center justify-center relative">
                        <img
                          src={formData.image}
                          alt="预览"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // 图片加载失败时显示占位符
                            const img = e.target as HTMLImageElement;
                            img.style.display = 'none';
                            const parent = img.parentElement;
                            if (parent && !parent.querySelector('.error-placeholder')) {
                              const placeholder = document.createElement('div');
                              placeholder.className = 'error-placeholder flex items-center justify-center w-full h-full';
                              placeholder.innerHTML = '<span class="text-xs text-[#637588] dark:text-[#9da8b9] text-center px-2">图片加载失败</span>';
                              parent.appendChild(placeholder);
                            }
                          }}
                        />
                      </div>
                      <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1 text-center">预览</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 外部市场ID (externalId) */}
              <div>
                <label className="block text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-1">
                  外部市场ID (externalId)
                </label>
                <input
                  type="text"
                  name="externalId"
                  value={formData.externalId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="请输入 Polymarket 的 market slug 或 ID"
                />
                <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">
                  请输入 Polymarket 的 market slug 或 ID，用于赔率自动同步
                </p>
              </div>

              {/* 市场描述 */}
              <div>
                <label className="block text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-1">市场描述</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
                  placeholder="请输入市场描述（可选）"
                />
              </div>

              {/* 市场ID */}
              <div>
                <label className="block text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-1">市场ID</label>
                <p className="text-sm font-mono text-[#111418] dark:text-white">{market.id}</p>
              </div>

              {/* 🔥 分类选择器（多选下拉框） */}
              <div>
                <label className="block text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-2">
                  分类标签 <span className="text-red-500">*</span>
                </label>
                {isLoadingCategories ? (
                  <p className="text-sm text-[#637588] dark:text-[#9da8b9]">加载分类中...</p>
                ) : (
                  <div className="border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] p-3 max-h-48 overflow-y-auto">
                    {allCategories.length === 0 ? (
                      <p className="text-sm text-[#637588] dark:text-[#9da8b9]">暂无分类</p>
                    ) : (
                      <div className="space-y-2">
                        {allCategories.map((category) => (
                          <label key={category.id} className="flex items-center gap-2 cursor-pointer hover:bg-[#f3f4f6] dark:hover:bg-[#283545] p-2 rounded">
                            <input
                              type="checkbox"
                              checked={formData.categoryIds.includes(category.id)}
                              onChange={(e) => handleCategoryChange(category.id, e.target.checked)}
                              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary focus:ring-2"
                            />
                            <span className="text-sm text-[#111418] dark:text-white">{category.name}</span>
                            <span className="text-xs text-[#637588] dark:text-[#9da8b9]">({category.slug})</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">
                  可以为市场分配多个分类标签，例如同时选择"加密货币"和"热门"
                </p>
              </div>

              {/* 🔥 热门开关 */}
              <div className="flex items-center justify-between p-4 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822]">
                <div>
                  <label className="block text-sm font-medium text-[#111418] dark:text-white mb-1">
                    设为热门 (Featured)
                  </label>
                  <p className="text-xs text-[#637588] dark:text-[#9da8b9]">
                    热门市场会在首页和"热门"分类中优先显示
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="isHot"
                    checked={formData.isHot}
                    onChange={handleInputChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                </label>
              </div>

              {/* 🔥 状态切换 */}
              <div>
                <label className="block text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-1">
                  审核状态
                </label>
                <select
                  name="reviewStatus"
                  value={formData.reviewStatus}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="PENDING">草稿（待审核）</option>
                  <option value="PUBLISHED">已发布</option>
                  <option value="REJECTED">已下架</option>
                </select>
                <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">
                  草稿：仅在后台可见；已发布：前端可见；已下架：前端不可见
                </p>
              </div>

              {/* 市场状态（只读） */}
              <div>
                <label className="block text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-1">市场状态</label>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    market.status === "OPEN"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : market.status === "RESOLVED"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                  }`}
                >
                  {market.status === "OPEN" ? "进行中" : market.status === "RESOLVED" ? "已结算" : market.status}
                </span>
                <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">
                  市场状态（进行中/已结算）由系统自动管理，无法手动修改
                </p>
              </div>

              {/* 结算结果 */}
              {market.status === "RESOLVED" && market.winningOutcome && (
                <div>
                  <label className="block text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-1">结算结果</label>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      market.winningOutcome === "YES"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {market.winningOutcome}
                  </span>
                </div>
              )}

              {/* 截止时间 */}
              <div>
                <label className="block text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-1">截止时间</label>
                <input
                  type="datetime-local"
                  name="closingDate"
                  value={formData.closingDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                {formData.closingDate && (
                  <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">
                    当前设置：{formatDateTime(new Date(formData.closingDate).toISOString())}
                  </p>
                )}
                </div>
                </div>
              </form>

            {/* 当前赔率和交易量 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* YES 赔率 */}
            <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-[#637588] dark:text-[#9da8b9]">YES 赔率</p>
                <span className="material-symbols-outlined text-green-500">trending_up</span>
              </div>
              <p className="text-2xl font-bold text-[#111418] dark:text-white">{market.yesPercent.toFixed(1)}%</p>
              <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">当前价格</p>
            </div>

            {/* NO 赔率 */}
            <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-[#637588] dark:text-[#9da8b9]">NO 赔率</p>
                <span className="material-symbols-outlined text-red-500">trending_down</span>
              </div>
              <p className="text-2xl font-bold text-[#111418] dark:text-white">{market.noPercent.toFixed(1)}%</p>
              <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">当前价格</p>
            </div>

            {/* 总交易量 */}
            <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-[#637588] dark:text-[#9da8b9]">总交易量</p>
                <span className="material-symbols-outlined text-primary">attach_money</span>
              </div>
              <p className="text-2xl font-bold text-[#111418] dark:text-white">{formatCurrency(market.volume)}</p>
              <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">累计交易额</p>
            </div>
            </div>

            {/* 时间信息（只读） */}
            <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6">
            <h3 className="text-base font-bold text-[#111418] dark:text-white mb-4">时间信息</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-1">截止时间</label>
                <p className="text-sm text-[#111418] dark:text-white">{formatDateTime(market.endTime)}</p>
              </div>
              {market.createdAt && (
                <div>
                  <label className="block text-sm font-medium text-[#637588] dark:text-[#9da8b9] mb-1">创建时间</label>
                  <p className="text-sm text-[#111418] dark:text-white">{formatDateTime(market.createdAt)}</p>
                </div>
              )}
              </div>
            </div>
          </div>

          {/* 右侧：管理操作表单 */}
          <div className="lg:col-span-1">
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm p-6 sticky top-6">
            <h2 className="text-lg font-bold text-[#111418] dark:text-white mb-6">市场结算</h2>

            {/* 如果市场已结算，显示结算结果 */}
            {market.status === "RESOLVED" ? (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">市场已结算</p>
                  <p className="text-base font-bold text-blue-900 dark:text-blue-200">
                    结算结果：{market.winningOutcome || "无效"}
                  </p>
                </div>
                <p className="text-xs text-[#637588] dark:text-[#9da8b9]">此市场已完成结算，无法再次修改。</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 结果选择器 */}
                <div>
                  <label className="block text-sm font-medium text-[#111418] dark:text-white mb-3">
                    选择结算结果 <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors hover:bg-[#f3f4f6] dark:hover:bg-[#283545]">
                      <input
                        type="radio"
                        name="resolutionOutcome"
                        value="YES"
                        checked={resolutionOutcome === "YES"}
                        onChange={(e) => setResolutionOutcome(e.target.value as "YES")}
                        className="w-4 h-4 text-primary border-gray-300 focus:ring-primary focus:ring-2"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-green-600 dark:text-green-400">YES</span>
                          <span className="text-sm text-[#637588] dark:text-[#9da8b9]">（是）</span>
                        </div>
                        <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">市场结果为肯定</p>
                      </div>
                    </label>

                    <label className="flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors hover:bg-[#f3f4f6] dark:hover:bg-[#283545]">
                      <input
                        type="radio"
                        name="resolutionOutcome"
                        value="NO"
                        checked={resolutionOutcome === "NO"}
                        onChange={(e) => setResolutionOutcome(e.target.value as "NO")}
                        className="w-4 h-4 text-primary border-gray-300 focus:ring-primary focus:ring-2"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-red-600 dark:text-red-400">NO</span>
                          <span className="text-sm text-[#637588] dark:text-[#9da8b9]">（否）</span>
                        </div>
                        <p className="text-xs text-[#637588] dark:text-[#9da8b9] mt-1">市场结果为否定</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 警告提示 */}
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-yellow-600 dark:text-yellow-400" style={{ fontSize: 20 }}>
                      warning
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">重要提示</p>
                      <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                        市场结算操作不可撤销，请确认结算结果无误后再执行。
                      </p>
                    </div>
                  </div>
                </div>

                {/* 结算按钮 */}
                <button
                  onClick={handleResolveMarket}
                  disabled={!resolutionOutcome || isResolving}
                  className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isResolving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>结算中...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                        check_circle
                      </span>
                      <span>确认结算市场</span>
                    </>
                  )}
                </button>
              </div>
              )}
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
