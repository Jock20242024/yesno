"use client";

import { useState, useEffect } from "react";
import { X, Edit2, Trash2 } from "lucide-react";

// 分类数据类型（支持父子级）
interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  displayOrder: number;
  status: string;
  level?: number;
  parentId?: string | null;
  parent?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  children?: Array<{
    id: string;
    name: string;
    slug: string;
    level: number;
  }>;
  marketCount?: number;
}

export default function CategoriesManagementPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    icon: "",
    sortOrder: "",
    displayOrder: "", // 保留用于兼容
    parentId: "",
    status: "active",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 获取分类列表
  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/categories", {
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success && data.data) {
        const categoriesWithCount = data.data.map((cat: Category) => ({
          ...cat,
          marketCount: 0, // 暂时设为 0，后续可以从 API 获取
        }));
        setCategories(categoriesWithCount);
      } else {
        console.error("获取分类列表失败:", data.error);
      }
    } catch (error) {
      console.error("获取分类列表失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 页面加载时获取分类列表
  useEffect(() => {
    fetchCategories();
  }, []);

  // 打开编辑对话框
  const handleEditClick = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      icon: category.icon || "",
      sortOrder: (category as any).sortOrder?.toString() || category.displayOrder.toString(),
      displayOrder: category.displayOrder.toString(),
      parentId: category.parentId || "",
      status: category.status,
    });
    setIsDialogOpen(true);
  };

  // 打开新建对话框
  const handleAddClick = () => {
    setEditingCategory(null);
    setFormData({
      name: "",
      icon: "",
      sortOrder: "",
      displayOrder: "",
      parentId: "",
      status: "active",
    });
    setIsDialogOpen(true);
  };

  // 关闭对话框
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCategory(null);
    setFormData({
      name: "",
      icon: "",
      sortOrder: "",
      displayOrder: "",
      parentId: "",
      status: "active",
    });
  };

  // 处理提交（新建或编辑）
  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert("分类名称不能为空");
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingCategory
        ? `/api/admin/categories/${editingCategory.id}`
        : "/api/admin/categories";
      const method = editingCategory ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name.trim(),
          icon: formData.icon || null,
          sortOrder: formData.sortOrder ? parseInt(formData.sortOrder) : undefined,
          displayOrder: formData.displayOrder ? parseInt(formData.displayOrder) : undefined,
          parentId: formData.parentId || null,
          status: formData.status,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await fetchCategories();
        handleCloseDialog();
        alert(editingCategory ? "分类更新成功！" : "分类创建成功！");
      } else {
        alert(data.error || "操作失败，请稍后重试");
      }
    } catch (error) {
      console.error("操作失败:", error);
      alert("操作失败，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理删除
  const handleDelete = async (categoryId: string) => {
    if (!confirm("确定要删除这个分类吗？删除后无法恢复。")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/categories/${categoryId}`, {
        method: "DELETE",
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        await fetchCategories();
        alert("分类删除成功！");
      } else {
        alert(data.error || "删除失败，请稍后重试");
      }
    } catch (error) {
      console.error("删除失败:", error);
      alert("删除失败，请稍后重试");
    }
  };

  // 获取所有顶级分类（用于父级选择下拉框）
  const getTopLevelCategories = (): Category[] => {
    return categories.filter((cat) => !cat.parentId && cat.status === 'active');
  };

  // 获取状态显示样式
  const getStatusDisplay = (status: string) => {
    if (status === "active") {
      return {
        text: "启用",
        className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      };
    } else {
      return {
        text: "禁用",
        className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
      };
    }
  };

  // 获取层级显示（缩进）
  const getLevelIndent = (level: number = 0) => {
    return level * 20; // 每级缩进 20px
  };

  return (
    <div className="mx-auto max-w-[1400px] flex flex-col gap-6">
      {/* 页面标题和操作按钮 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111418] dark:text-white">分类管理</h1>
          <p className="text-sm text-[#637588] dark:text-[#9da8b9] mt-1">管理市场分类，支持父子级嵌套结构</p>
        </div>
        <button
          onClick={handleAddClick}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm text-sm font-medium whitespace-nowrap"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
          添加新分类
        </button>
      </div>

      {/* 分类列表表格 */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#f3f4f6] dark:bg-[#1a2332] border-b border-[#e5e7eb] dark:border-[#283545]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">
                  名称
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">
                  父级分类
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">
                  层级
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">
                  图标
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">
                  市场数量
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-[#637588] dark:text-[#9da8b9] uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb] dark:divide-[#283545]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#637588] dark:text-[#9da8b9]">
                    加载中...
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[#637588] dark:text-[#9da8b9]">
                    暂无分类数据
                  </td>
                </tr>
              ) : (
                categories.map((category) => {
                  const statusDisplay = getStatusDisplay(category.status);
                  return (
                    <tr
                      key={category.id}
                      className="hover:bg-[#f9fafb] dark:hover:bg-[#283545] transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div style={{ paddingLeft: `${getLevelIndent(category.level || 0)}px` }}>
                            <div className="text-sm font-medium text-[#111418] dark:text-white">
                              {category.name}
                            </div>
                            <div className="text-xs text-[#637588] dark:text-[#9da8b9] mt-0.5">
                              {category.slug}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-[#111418] dark:text-white">
                          {category.parent?.name || "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-[#111418] dark:text-white">
                          {category.level || 0} 级
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-[#111418] dark:text-white">
                          {category.icon || "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-[#111418] dark:text-white">
                          {category.marketCount || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusDisplay.className}`}
                        >
                          {statusDisplay.text}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEditClick(category)}
                          className="text-primary hover:text-blue-600 mr-4 flex items-center gap-1"
                        >
                          <Edit2 className="w-4 h-4" />
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(category.id)}
                          className="text-red-600 hover:text-red-700 flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          删除
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 添加/编辑分类对话框 */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-[#e5e7eb] dark:border-[#283545] shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            {/* 对话框头部 */}
            <div className="flex items-center justify-between p-6 border-b border-[#e5e7eb] dark:border-[#283545] sticky top-0 bg-card-light dark:bg-card-dark">
              <h2 className="text-xl font-bold text-[#111418] dark:text-white">
                {editingCategory ? "编辑分类" : "添加新分类"}
              </h2>
              <button
                onClick={handleCloseDialog}
                className="text-[#637588] dark:text-[#9da8b9] hover:text-[#111418] dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 对话框内容 */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
                  分类名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
                  placeholder="例如：娱乐"
                  autoFocus
                />
                <p className="mt-1 text-xs text-[#637588] dark:text-[#9da8b9]">
                  分类名称将用于前台展示，slug 将自动生成
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
                  所属父级
                </label>
                <select
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
                >
                  <option value="">无（顶级分类）</option>
                  {getTopLevelCategories()
                    .filter((cat) => !editingCategory || cat.id !== editingCategory.id)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-[#637588] dark:text-[#9da8b9]">
                  选择父级分类以创建层级结构，留空则为顶级分类
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
                  图标名称
                </label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
                  placeholder="例如：Film"
                />
                <p className="mt-1 text-xs text-[#637588] dark:text-[#9da8b9]">
                  图标名称用于前端展示，留空使用默认图标
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
                  显示排序 (sortOrder)
                </label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                  className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
                  placeholder="数字越小越靠前（用于排序）"
                />
                <p className="mt-1 text-xs text-[#637588] dark:text-[#9da8b9]">
                  用于控制分类在导航栏和列表中的显示顺序
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
                  状态
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="block w-full px-4 py-2.5 border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm"
                >
                  <option value="active">启用</option>
                  <option value="inactive">禁用</option>
                </select>
              </div>
            </div>

            {/* 对话框底部 */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-[#e5e7eb] dark:border-[#283545] sticky bottom-0 bg-card-light dark:bg-card-dark">
              <button
                onClick={handleCloseDialog}
                className="px-4 py-2 text-sm font-medium text-[#111418] dark:text-white bg-white dark:bg-[#101822] border border-[#d1d5db] dark:border-[#3e4e63] rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#283545] transition-colors"
                disabled={isSubmitting}
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.name.trim() || isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting
                  ? editingCategory
                    ? "更新中..."
                    : "创建中..."
                  : editingCategory
                  ? "更新分类"
                  : "创建分类"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
