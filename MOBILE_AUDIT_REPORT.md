# 📱 移动端体验缺陷报告 (Mobile Experience Audit Report)

**生成时间**: 2025-01-30  
**审计范围**: Web3 预测市场平台移动端适配  
**参考标准**: Polymarket, Kalshi, Manifold Markets

---

## 🔴 严重问题 (Critical Issues)

### 1. 布局溢出风险 (Layout Overflow)
- **位置**: `components/MarketTable.tsx`, `app/(public)/data/DataClient.tsx`
- **问题**: 表格列使用 `min-w-[280px]` 和 `min-w-[200px]`，在 375px 移动设备上必然溢出
- **影响**: 导致横向滚动，破坏用户体验
- **优先级**: P0

### 2. 钱包数字显示抖动 (Balance Display Jitter)
- **位置**: `components/user/LiveWallet.tsx`
- **问题**: 未使用 `tabular-nums` 字体样式，数字宽度变化导致布局抖动
- **影响**: 余额更新时界面跳动，影响专业感
- **优先级**: P1

### 3. 点击区域不足 (Insufficient Hit Area)
- **位置**: `components/Navbar.tsx` (登录/注册按钮)
- **问题**: 移动端按钮可能小于 44px × 44px 最小触摸目标
- **影响**: 移动端点击困难，违反 WCAG 2.1 可访问性标准
- **优先级**: P1

---

## 🟡 中等问题 (Medium Issues)

### 4. 硬编码中文文案 (Hardcoded Chinese Text)
- **位置**: 全站多处
- **问题**: 
  - `components/Navbar.tsx`: "总资产", "可用", "搜索市场", "排行榜", "登出", "登录", "注册"
  - `app/layout.tsx`: "预测未来，赢取丰厚奖励"
  - `components/market-detail/OrderBook.tsx`: "订单簿", "事件评论", "持有者", "规则"
- **影响**: 无法国际化，限制全球用户使用
- **优先级**: P2

### 5. 缺少加载骨架屏 (Missing Skeleton Screens)
- **位置**: `components/market-detail/OrderBook.tsx`, `components/user/LiveWallet.tsx`
- **问题**: 异步数据加载时只显示 "Loading..." 文字，无骨架屏
- **影响**: 加载体验不专业，用户感知等待时间长
- **优先级**: P2

### 6. 钱包地址未截断 (Wallet Address Not Truncated)
- **位置**: 用户资料、交易历史等页面
- **问题**: 长地址（0x...）可能完整显示，在小屏幕上溢出
- **影响**: 布局破坏，可读性差
- **优先级**: P2

---

## 🟢 轻微问题 (Minor Issues)

### 7. 颜色对比度未验证 (Color Contrast Not Verified)
- **位置**: `components/market-detail/OutcomeSelector.tsx`
- **问题**: Yes/No 按钮和赔率数字的颜色对比度未经过 WCAG AA 标准验证
- **影响**: 在强光环境下可能难以阅读
- **优先级**: P3

### 8. 响应式间距未优化 (Responsive Spacing Not Optimized)
- **位置**: 多个组件
- **问题**: 移动端和桌面端使用相同的间距（gap-8, px-6 等）
- **影响**: 移动端空间利用率低，视觉拥挤
- **优先级**: P3

---

## 📊 统计数据

- **严重问题**: 3 项
- **中等问题**: 3 项
- **轻微问题**: 2 项
- **总计**: 8 项待修复

---

## 🎯 修复优先级建议

1. **立即修复** (P0): 布局溢出问题
2. **本周修复** (P1): 钱包数字抖动、点击区域
3. **本月修复** (P2): 国际化、骨架屏、地址截断
4. **持续优化** (P3): 对比度、间距优化

---

## 📝 备注

- 所有修复应遵循 "Mobile First" 设计原则
- 参考 Polymarket 的移动端交互模式
- 确保所有数值使用 `tabular-nums` 防止抖动
- 按钮最小触摸目标: 44px × 44px

