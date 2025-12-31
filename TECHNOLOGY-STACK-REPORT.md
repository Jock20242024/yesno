# 📊 YesNo App 技术栈概览报告

> **生成时间**: 2024年
> **项目名称**: yesno-app
> **项目类型**: 预测市场平台（Polymarket 仿制应用）

---

## 1. 核心框架

### Next.js
- **版本**: `^14.0.0`
- **路由方式**: **App Router** ✅
  - 证据：项目根目录存在 `app/` 目录结构
  - 使用 `app/layout.tsx` 作为根布局
  - 路由文件使用 `page.tsx` 命名约定
  - API 路由位于 `app/api/` 目录

### React
- **版本**: `^18.2.0`
- **模式**: React 18 严格模式已启用（`reactStrictMode: true`）

### TypeScript
- **版本**: `^5.9.3`
- **配置**: 严格模式 (`strict: true`)
- **路径别名**: `@/*` 映射到项目根目录

---

## 2. 样式方案 (Styling)

### ✅ Tailwind CSS
- **版本**: `^3.3.6`
- **配置文件**: 
  - `tailwind.config.js` ✅ 存在
  - `postcss.config.js` ✅ 存在（配置了 `tailwindcss` 和 `autoprefixer`）
- **全局样式**: `app/globals.css` 包含 `@tailwind` 指令
- **使用方式**: 组件中广泛使用 `className` 属性，例如：
  ```tsx
  className="w-full bg-pm-card rounded-xl border border-pm-border p-6"
  ```
- **自定义主题**: 
  - 深色模式支持 (`darkMode: "class"`)
  - 自定义颜色系统（pm-bg, pm-card, pm-green, pm-red 等）
  - 自定义字体（Inter, Noto Sans SC）

### 样式特点
- **无 CSS Modules**: 未发现 `.module.css` 文件
- **无 SCSS/SASS**: 未发现 `.scss` 或 `.sass` 文件
- **无 Styled Components**: 未发现 `styled-components` 依赖
- **纯 Tailwind**: 完全基于 Tailwind CSS 工具类

---

## 3. 后端与数据库

### ORM: Prisma
- **版本**: `^6.0.0`
- **客户端**: `@prisma/client@^6.0.0`
- **配置文件**: `prisma/schema.prisma`

### 数据库: PostgreSQL
- **类型**: PostgreSQL ✅
- **证据**: `prisma/schema.prisma` 中明确声明：
  ```prisma
  datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
  }
  ```

### 数据库模型概览
主要模型包括：
- `User` - 用户表
- `Market` - 市场表
- `Order` - 订单表（支持 MARKET/LIMIT 订单）
- `Position` - 持仓表
- `Transaction` - 交易流水表
- `Category` - 分类表
- `MarketTemplate` - 市场模板表
- `AdminLog` - 管理员日志表
- 等 10+ 个模型

---

## 4. 核心依赖库

### 认证系统
- **NextAuth.js**: `^5.0.0-beta.30`
  - 统一认证系统
  - 支持 OAuth（Google）
  - Session 管理

### 数据获取
- **SWR**: `^2.3.8`
  - 客户端数据获取和缓存
  - 实时数据同步

### UI 组件库
- **Lucide React**: `^0.294.0`
  - 图标库（替代 Feather Icons）
- **Sonner**: `^2.0.7`
  - Toast 通知组件
- **Vaul**: `^1.1.2`
  - Drawer 组件库

### 图表与可视化
- **Recharts**: `^3.5.1`
  - React 图表库（用于价格走势图）

### 日期处理
- **Day.js**: `^1.11.19`
  - 轻量级日期处理库

### 任务队列与缓存
- **BullMQ**: `^5.66.2`
  - Redis 任务队列（用于定时任务、市场工厂等）
- **ioredis**: `^5.8.2`
  - Redis 客户端

### 工具库
- **bcryptjs**: `^3.0.3`
  - 密码加密
- **canvas-confetti**: `^1.9.4`
  - 庆祝动画效果
- **node-cron**: `^3.0.3`
  - 定时任务调度

### 其他
- **qrcode.react**: `^4.2.0`
  - QR 码生成
- **html-to-image**: `^1.11.13`
  - HTML 转图片
- **downloadjs**: `^1.4.7`
  - 文件下载工具

---

## 5. 状态管理

### React Context API
项目使用 **React Context API** 进行状态管理，**未使用** Redux 或 Zustand。

主要 Context：
1. **StoreContext** (`app/context/StoreContext.tsx`)
   - 管理用户余额、持仓、交易历史
   - 提供 `executeTrade` 等交易方法

2. **AuthContext** (`contexts/AuthContext.tsx` 和 `components/providers/AuthProvider.tsx`)
   - 管理用户认证状态
   - 与 NextAuth 集成

3. **NotificationProvider** (`components/providers/NotificationProvider.tsx`)
   - 管理全局通知状态

---

## 6. 项目结构

```
yesno-app/
├── app/                    # Next.js App Router
│   ├── (public)/           # 公开路由组
│   ├── (protected)/       # 受保护路由组
│   ├── admin/             # 后台管理
│   ├── api/               # API 路由
│   ├── markets/           # 市场详情页
│   ├── wallet/            # 钱包页面
│   └── layout.tsx         # 根布局
├── components/            # React 组件
│   ├── market-detail/     # 市场详情相关组件
│   └── providers/         # Context Providers
├── lib/                   # 工具库
│   ├── auth/              # 认证工具
│   ├── factory/           # 市场工厂逻辑
│   ├── scrapers/          # 数据爬虫
│   └── utils/             # 通用工具
├── prisma/                # Prisma 配置
│   └── schema.prisma     # 数据库模型
├── scripts/               # 脚本文件
├── hooks/                 # 自定义 Hooks
├── types/                 # TypeScript 类型定义
└── contexts/              # Context 定义
```

---

## 7. 开发工具

### 构建工具
- **Next.js 内置 SWC**: 用于编译和压缩
- **PostCSS**: `^8.4.32` + **Autoprefixer**: `^10.4.16`

### 开发依赖
- **ts-node**: `^10.9.2` - TypeScript 脚本执行
- **@types/node**: `^20.19.27` - Node.js 类型定义
- **@types/react**: `^18.2.0` - React 类型定义

---

## 8. 特殊功能

### 市场工厂系统
- 自动化市场生成（基于模板）
- 定时任务（Cron Jobs）
- 外部数据同步（Polymarket 爬虫）

### 交易系统
- 支持市价单（MARKET）和限价单（LIMIT）
- AMM（自动做市商）价格计算
- 订单簿（Order Book）显示

### 后台管理
- 完整的 Admin Dashboard
- 市场审核系统
- 用户管理
- 结算监控

---

## 9. 配置文件清单

| 文件 | 用途 |
|------|------|
| `package.json` | 项目依赖和脚本 |
| `tsconfig.json` | TypeScript 配置 |
| `next.config.js` | Next.js 配置 |
| `tailwind.config.js` | Tailwind CSS 配置 |
| `postcss.config.js` | PostCSS 配置 |
| `prisma/schema.prisma` | Prisma 数据库模型 |
| `.env.local` | 环境变量（需自行创建） |

---

## 10. 总结

### 技术栈特点
✅ **现代化**: Next.js 14 App Router + TypeScript  
✅ **样式**: 纯 Tailwind CSS，无其他 CSS 方案  
✅ **数据库**: PostgreSQL + Prisma ORM  
✅ **状态管理**: React Context API（轻量级）  
✅ **认证**: NextAuth.js 5.0（统一认证）  
✅ **数据获取**: SWR（客户端缓存）  
✅ **任务队列**: BullMQ + Redis  

### 架构模式
- **全栈框架**: Next.js（服务端 + 客户端）
- **API 路由**: Next.js API Routes（`app/api/`）
- **数据库访问**: Prisma Client（类型安全）
- **实时数据**: SWR + 轮询/手动刷新

---

## 📝 备注

- 项目使用 **Next.js 14 App Router**，这是 Next.js 的最新路由系统
- 样式完全基于 **Tailwind CSS**，没有混用其他 CSS 方案
- 数据库使用 **PostgreSQL**，通过 **Prisma** 进行类型安全的 ORM 操作
- 状态管理采用 **React Context API**，适合中小型应用
- 认证系统已迁移到 **NextAuth.js 5.0**（Beta 版本）

---

**报告生成完成** ✅
