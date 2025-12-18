# 前端稳定性规则（Frontend Stability Rules）

本文档定义了项目的核心稳定性规则，确保系统在长期迭代中保持稳定，避免白屏、404、hydration 错误等问题。

## 一、Page / Client 职责边界（硬规则）

### ✅ Page（page.tsx）职责
- **必须**是 Server Component（默认，不写 `'use client'`）
- **只能**做：
  - 数据获取（fetch）
  - 布局容器
  - Suspense 边界
  - 将数据通过 props 传递给 Client Component
- **禁止**：
  - ❌ 使用 `useAuth()` / `useContext()` / `useStore()`
  - ❌ 访问 `window` / `localStorage` / `document`
  - ❌ 使用 `useEffect` / `useState`
  - ❌ 包含业务逻辑
  - ❌ 直接渲染复杂 UI

### ✅ Client Component 职责
- **必须**在文件顶部声明 `'use client'`
- **只能**做：
  - UI 渲染
  - 用户交互处理
  - 通过 props 接收数据
- **禁止**：
  - ❌ 直接读取 Context（必须在 Page 或 Layout 读取后通过 props 传入）
  - ❌ 在组件顶层访问 `window` / `localStorage`（必须在 `useEffect` 中）
  - ❌ 在组件顶层调用 `toast()` / `connect()` 等副作用函数

### 📋 示例结构

```typescript
// app/page.tsx (Server Component)
import { Suspense } from 'react';
import ClientPage from './ClientPage';

export default function Page() {
  // ✅ 可以：数据获取、Suspense
  return (
    <Suspense fallback={<Loading />}>
      <ClientPage />
    </Suspense>
  );
}

// app/ClientPage.tsx (Client Component)
'use client';

export default function ClientPage({ data }: { data: any }) {
  // ✅ 可以：UI 渲染、交互
  // ❌ 禁止：useAuth()、useStore()
  return <div>{/* UI */}</div>;
}
```

## 二、Context 使用规范（硬规则）

### ✅ Provider 规范
- **必须**永远渲染 `<Context.Provider>{children}</Context.Provider>`
- **禁止** `return null`（会导致 App Shell 被卸载，刷新必白屏）
- **必须**提供 `isLoading` / `isReady` 状态

### ✅ Context 消费规范
- **Page / Layout 级别**：✅ 允许使用 `useAuth()` / `useStore()`
- **业务组件级别**：❌ 禁止直接使用，必须通过 props 传入

### 📋 示例

```typescript
// ✅ 正确：Page 级别读取 Context
export default function Page() {
  const { isLoggedIn } = useAuth();
  return <MarketCard isLoggedIn={isLoggedIn} />;
}

// ❌ 错误：子组件直接读取 Context
export default function MarketCard() {
  const { isLoggedIn } = useAuth(); // ❌ 禁止
  return <div>...</div>;
}
```

## 三、禁止行为清单（硬规则）

### ❌ 绝对禁止
1. **Provider 中 `return null`**
   - 会导致 App Shell 被卸载
   - 刷新页面必白屏

2. **error.tsx / loading.tsx 中包含 `<html><body>`**
   - 只有 `app/layout.tsx` 可以定义 `<html><body>`
   - 其他文件包含会破坏 DOM 结构

3. **组件顶层副作用**
   - `window` / `document` / `localStorage` 访问必须在 `useEffect` 中
   - `toast()` / `connect()` 等必须在事件处理函数中

4. **子组件直接依赖 Context ready 状态**
   - Card / Row / ListItem 组件禁止 `useAuth()` / `useStore()`
   - 必须通过 props 传入

5. **Page 中使用 `notFound()` / `redirect()` 在顶层**
   - 必须在条件判断中，且不能是默认路径

## 四、新页面开发 Checklist

### ✅ 创建新页面时必须检查
- [ ] `page.tsx` 是 Server Component（无 `'use client'`）
- [ ] 如果页面需要交互，创建 `ClientPage.tsx` 并声明 `'use client'`
- [ ] 创建 `loading.tsx`（即使内容简单）
- [ ] 如果使用 Context，在 Page 级别读取，通过 props 传给 Client Component
- [ ] 不包含顶层副作用（`window`、`localStorage` 等）
- [ ] Provider 不 `return null`

### ✅ 创建新组件时必须检查
- [ ] 如果是 Client Component，顶部有 `'use client'`
- [ ] 不直接使用 `useAuth()` / `useStore()`（通过 props 接收）
- [ ] 不包含顶层副作用
- [ ] 有 `isLoading` 防御（如果依赖 Context）

## 五、错误处理规范

### ✅ Error Boundary
- `app/error.tsx` 必须存在
- 不包含 `<html><body>`
- 只返回 `<div>` 内容

### ✅ Loading State
- 所有页面目录必须有 `loading.tsx`
- 内容简单即可：`<div>Loading...</div>`

### ✅ Not Found
- `app/not-found.tsx` 必须存在
- 不包含 `<html><body>`

## 六、刷新白屏防护

### ✅ 必须满足
1. **所有 Provider 永远渲染 children**
   ```typescript
   // ✅ 正确
   return <Context.Provider>{children}</Context.Provider>;
   
   // ❌ 错误
   if (isLoading) return null;
   ```

2. **所有页面有 loading.tsx**
   - 防止 Server / Client 切换期白屏

3. **error.tsx 不破坏 DOM**
   - 只返回 `<div>`，不包含 `<html><body>`

4. **Context 未 ready 时，业务组件返回 skeleton**
   - 不 `return null`
   - 保持 DOM 结构稳定

## 七、验证标准

每次修改后必须验证：
- ✅ 刷新页面 10 次不白屏
- ✅ 访问所有主要路由正常（`/`、`/category/[slug]`、`/markets/[id]`）
- ✅ 删除浏览器缓存后仍可正常渲染
- ✅ 任何一个组件报错 → error.tsx 接管，不白屏
- ✅ Network 中所有 chunk 文件返回 200

## 八、常见问题

### Q: 为什么 Provider 不能 return null？
A: 会导致整个 App Shell 被卸载，刷新时 React 找不到稳定的 DOM 结构，必白屏。

### Q: 为什么子组件不能直接 useAuth()？
A: 会导致 hydration mismatch。Context 未 ready 时，子组件访问未初始化的 Context 会导致 SSR 和客户端渲染不一致。

### Q: 为什么 error.tsx 不能包含 <html><body>？
A: 只有 `app/layout.tsx` 可以定义 `<html><body>`。error.tsx 包含会破坏 DOM 结构，导致 Next.js 无法正确渲染。

---

**最后更新：** 2024-12-16  
**维护者：** 开发团队  
**版本：** 1.0
