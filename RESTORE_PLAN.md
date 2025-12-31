# 🔄 恢复方案：回到多语言改动之前

## 📍 恢复目标

**恢复到提交：** `2479099` (feat: 赔率同步下一阶段版本 - 包含强力匹配与实时同步修复)  
**提交时间：** 2025-12-25 04:19:35  
**提交信息：** feat: 赔率同步下一阶段版本 (Odds Sync Phase 2) - 包含强力匹配与实时同步修复

这是最新的稳定提交，在多语言改动之前。

---

## 📋 恢复操作清单

### 步骤 1: 恢复所有已修改的文件

```bash
git reset --hard HEAD
```

**这会恢复以下文件到最新提交状态：**
- `app/providers.tsx` - 移除 I18nProvider 相关代码
- `components/Navbar.tsx` - 移除 useI18n 和三语言切换按钮
- 其他所有已修改的文件（约 100+ 个文件）

---

### 步骤 2: 删除多语言相关的未跟踪文件

```bash
# 删除 i18n-store
rm -f lib/i18n-store.tsx

# 删除 next-intl 相关文件
rm -f navigation.ts
rm -f config.ts
rm -f i18n.ts

# 删除 messages 目录（如果存在）
rm -rf messages/

# 删除 LanguageSwitcher 组件（如果存在）
rm -f components/LanguageSwitcher.tsx

# 删除 middleware.ts（如果存在）
rm -f middleware.ts
```

**要删除的文件清单：**
- ✅ `lib/i18n-store.tsx` - 自定义 i18n store
- ✅ `navigation.ts` - next-intl 导航包装
- ✅ `config.ts` - next-intl 配置
- ✅ `i18n.ts` - next-intl 配置
- ✅ `messages/` - 翻译文件目录
- ✅ `components/LanguageSwitcher.tsx` - 语言切换组件
- ✅ `middleware.ts` - next-intl 中间件（如果存在）

---

### 步骤 3: 清理构建缓存

```bash
rm -rf .next
```

**目的：** 清除 Next.js 构建缓存，确保重新构建时使用恢复后的代码。

---

## 🔍 恢复后的文件状态

### `app/providers.tsx` 会恢复成：

```typescript
'use client';

import { StoreProvider } from '@/app/context/StoreContext';
import { AuthProvider } from "@/components/providers/AuthProvider";
import { NotificationProvider } from "@/components/providers/NotificationProvider";
import { ErrorBoundary } from "@/components/providers/ErrorBoundary";
import Navbar from "@/components/Navbar";
import CategoryBar from "@/components/CategoryBar";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { usePathname } from 'next/navigation';

// 🔥 全局初始化 Dayjs：在应用启动时一次性加载所有需要的插件
import '@/lib/dayjs';

function ConditionalUI({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // 检查是否为管理后台路径
  const isAdminPath = pathname?.startsWith('/admin');

  return (
    <>
      {/* Navbar 仅在非 Admin 路径下渲染 */}
      {!isAdminPath && <Navbar />}
      {/* 管理后台路径不渲染 CategoryBar */}
      {!isAdminPath && (
        <CategoryBar />
      )}
      {children}
      <ToastProvider />
    </>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <StoreProvider>
          <NotificationProvider>
            <ConditionalUI>
              {children}
            </ConditionalUI>
          </NotificationProvider>
        </StoreProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
```

**关键变化：**
- ❌ 移除 `import { I18nProvider } from '@/lib/i18n-store';`
- ❌ 移除 `<I18nProvider>` 包裹
- ✅ 恢复原来的 Provider 结构

---

### `components/Navbar.tsx` 会恢复成：

**关键变化：**
- ❌ 移除 `import { useI18n } from "@/lib/i18n-store";`
- ❌ 移除 `const { language, setLanguage } = useI18n();`
- ❌ 移除语言切换按钮
- ❌ 移除所有 `{language === 'en' ? 'English' : '中文'}` 三元表达式
- ✅ 恢复原来的硬编码中文文本

---

## ⚠️ 注意事项

1. **未提交的改动会丢失**：`git reset --hard HEAD` 会丢弃所有未提交的改动
2. **未跟踪的文件需要手动删除**：git 不会自动删除未跟踪的文件
3. **构建缓存需要清理**：确保 `.next` 目录被删除

---

## 🚀 执行顺序

如果你想执行恢复，按以下顺序操作：

```bash
# 1. 恢复所有已修改的文件
git reset --hard HEAD

# 2. 删除多语言相关文件
rm -f lib/i18n-store.tsx navigation.ts config.ts i18n.ts middleware.ts
rm -rf messages/
rm -f components/LanguageSwitcher.tsx

# 3. 清理构建缓存
rm -rf .next

# 4. 验证恢复结果
git status

# 5. 重新启动开发服务器
npm run dev
```

---

## ✅ 恢复后验证

恢复后，请检查：

1. ✅ `app/providers.tsx` 中没有 `I18nProvider`
2. ✅ `components/Navbar.tsx` 中没有 `useI18n`
3. ✅ `lib/i18n-store.tsx` 不存在
4. ✅ `messages/` 目录不存在
5. ✅ `npm run dev` 可以正常启动
6. ✅ 页面显示正常（中文文本）

---

## 🔄 如果想保留当前改动

如果你想要保留当前的改动作为备份，可以先创建一个分支：

```bash
# 创建备份分支
git checkout -b backup-with-i18n

# 提交当前改动（包括未跟踪文件）
git add -A
git commit -m "backup: 多语言实现版本（备份）"

# 切换回 main 分支
git checkout main

# 然后执行恢复操作
git reset --hard HEAD
```

这样你就可以随时回到多语言版本。

