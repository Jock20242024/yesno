# 代码总结文档

## 项目概述

这是一个基于 Next.js 的预测市场应用（Yes/No Market），支持用户下注、充值、提现等功能，包含完整的管理员后台系统。

---

## 重要文件清单

### 核心修复文件（P1 数据隔离安全修复）

#### 后端 API 路由
- `app/api/auth/me/route.ts` - 用户信息 API（已修复数据隔离，强制使用 Auth Token 提取 userId）
- `app/api/orders/user/route.ts` - 用户订单 API（已修复数据隔离，强制使用 userId 过滤）
- `app/api/transactions/route.ts` - 交易记录 API（已修复数据隔离，强制使用 userId 过滤）
- `app/api/orders/route.ts` - 创建订单 API（已修复数据隔离，强制使用 userId 创建记录）
- `app/api/deposit/route.ts` - 充值 API（已修复数据隔离，强制使用 userId 创建记录）
- `app/api/withdraw/route.ts` - 提现 API（已修复数据隔离，强制使用 userId 创建记录）
- `app/api/markets/[market_id]/route.ts` - 市场详情 API（已修复数据隔离，强制使用 userId 过滤订单）
- `app/api/users/[user_id]/route.ts` - 用户详情 API（已修复数据隔离，强制用户 ID 匹配检查）

#### 数据库服务层
- `lib/dbService.ts` - 数据库服务（已修复数据隔离，所有查询强制使用 userId 过滤）
  - `findOrdersByUserId(userId)` - 获取用户订单（强制 WHERE userId = current_user_id）
  - `findUserTransactions(userId)` - 获取用户交易记录（强制 WHERE userId = current_user_id）
  - `addOrder(order)` - 创建订单（强制使用 order.userId）
  - `addDeposit(deposit)` - 创建充值记录（强制使用 deposit.userId）
  - `addWithdrawal(withdrawal)` - 创建提现记录（强制使用 withdrawal.userId）
- `lib/authUtils.ts` - 统一的用户 ID 提取工具（extractUserIdFromToken）

#### 前端组件
- `components/providers/AuthProvider.tsx` - 认证提供者（已修复用户 ID 验证，强制 UUID 格式检查）
- `app/wallet/page.tsx` - 钱包页面（已修复前端调用检查，确保 currentUser.id 有效时才发起 API 请求）
- `app/admin/withdrawals/page.tsx` - 管理员提现页面（已修复 pagination 错误）

#### 配置文件
- `prisma/schema.prisma` - 数据库架构（User, Market, Order, Deposit, Withdrawal 模型）
- `middleware.ts` - 路由中间件（Admin 路由保护）
- `next.config.js` - Next.js 配置

---

## 核心功能模块

### 1. 用户认证系统
- **登录/注册**：`app/api/auth/login/route.ts`, `app/api/auth/register/route.ts`
- **会话管理**：`components/providers/AuthProvider.tsx`
- **Token 提取**：`lib/authUtils.ts`（统一的 extractUserIdFromToken 函数）

### 2. 市场系统
- **市场列表**：`app/api/markets/route.ts`
- **市场详情**：`app/api/markets/[market_id]/route.ts`
- **市场创建**：`app/api/admin/markets/route.ts`（管理员）

### 3. 交易系统
- **下注/订单**：`app/api/orders/route.ts`
- **用户订单**：`app/api/orders/user/route.ts`
- **交易历史**：`app/api/transactions/route.ts`

### 4. 资金系统
- **充值**：`app/api/deposit/route.ts`
- **提现**：`app/api/withdraw/route.ts`
- **余额查询**：`app/api/auth/me/route.ts`

### 5. 管理员系统
- **管理员登录**：`app/api/admin/auth/login/route.ts`
- **用户管理**：`app/api/admin/users/route.ts`
- **市场管理**：`app/api/admin/markets/route.ts`
- **提现审批**：`app/api/admin/withdrawals/route.ts`

---

## 数据库架构

### 主要数据模型

**User（用户）**
- `id` (UUID) - 主键
- `email` (String, Unique) - 邮箱
- `passwordHash` (String) - 密码哈希
- `balance` (Decimal) - 余额
- `isAdmin` (Boolean) - 是否管理员
- `isBanned` (Boolean) - 是否被禁用

**Market（市场）**
- `id` (UUID) - 主键
- `title` (String) - 标题
- `description` (Text) - 描述
- `closingDate` (DateTime) - 截止日期
- `status` (Enum) - 状态（OPEN, CLOSED, RESOLVED）
- `totalVolume` (Decimal) - 总交易量
- `totalYes` (Decimal) - YES 总金额
- `totalNo` (Decimal) - NO 总金额
- `category` (String?) - 分类
- `categorySlug` (String?) - 分类 slug

**Order（订单）**
- `id` (String) - 主键
- `userId` (UUID) - 用户 ID（外键）
- `marketId` (UUID) - 市场 ID（外键）
- `outcomeSelection` (Enum) - 选择（YES/NO）
- `amount` (Decimal) - 金额
- `feeDeducted` (Decimal) - 手续费
- `payout` (Decimal?) - 支付金额

**Deposit（充值）**
- `id` (String) - 主键
- `userId` (UUID) - 用户 ID（外键）
- `amount` (Decimal) - 金额
- `txHash` (String) - 交易哈希
- `status` (Enum) - 状态

**Withdrawal（提现）**
- `id` (String) - 主键
- `userId` (UUID) - 用户 ID（外键）
- `amount` (Decimal) - 金额
- `targetAddress` (String) - 目标地址
- `status` (Enum) - 状态

---

## 安全修复总结

### P1 数据隔离安全修复

#### 1. 用户会话审计
- ✅ `AuthProvider.tsx`：强制验证 `currentUser.id` 是有效的 UUID 格式
- ✅ 拒绝硬编码的 '1' 或 'default' 作为用户 ID
- ✅ `/api/auth/me`：使用 `extractUserIdFromToken()` 提取 `current_user_id`

#### 2. DBService 审计与修复
- ✅ `findOrdersByUserId(userId)`：强制使用 `WHERE userId = current_user_id` 过滤
- ✅ `findUserTransactions(userId)`：强制使用 `WHERE userId = current_user_id` 过滤
- ✅ 所有方法都验证 `userId` 是有效的 UUID 格式
- ✅ 拒绝硬编码的 '1' 或 'default'
- ✅ 如果 `current_user_id` 无效，返回空数组 `[]`

#### 3. 前端调用检查
- ✅ `WalletPage.tsx`：确保在 `currentUser.id` 有效时才发起 API 请求
- ✅ 验证 `currentUser.id` 是有效的 UUID 格式
- ✅ 防止使用硬编码的 '1' 或 'default'

---

## 快速开始指南

### 环境要求
- Node.js 18+
- PostgreSQL 数据库
- npm 或 yarn

### 安装步骤

1. **安装依赖**
```bash
npm install
```

2. **配置环境变量**
创建 `.env` 文件：
```env
DATABASE_URL="postgresql://user:password@localhost:5432/yesno_db"
```

3. **初始化数据库**
```bash
# 运行数据库迁移
npx prisma migrate dev

# 生成 Prisma Client
npx prisma generate

# （可选）填充测试数据
npx prisma db seed
```

4. **启动开发服务器**
```bash
npm run dev
```

5. **访问应用**
- 前端：http://localhost:3000
- 管理员后台：http://localhost:3000/admin/login

---

## 安全注意事项

### ⚠️ 重要安全措施

1. **数据隔离**
   - ✅ 所有用户专属数据查询都强制使用 `WHERE userId = current_user_id`
   - ✅ 所有 API 路由都从 Auth Token 提取 `current_user_id`
   - ✅ 所有 DBService 方法都验证 `userId` 是有效的 UUID 格式
   - ✅ 拒绝硬编码的 '1' 或 'default' 作为用户 ID

2. **认证与授权**
   - ✅ 使用 HttpOnly Cookie 存储认证 Token
   - ✅ 管理员路由使用中间件保护
   - ✅ 用户只能访问自己的数据

3. **输入验证**
   - ✅ 所有 API 路由都验证输入参数
   - ✅ UUID 格式验证
   - ✅ 金额验证（非负数）

4. **数据库事务**
   - ✅ 关键操作使用 `prisma.$transaction` 确保原子性
   - ✅ 余额更新和订单创建在同一事务中

### 🔒 生产环境检查清单

- [ ] 确保 `.env` 文件不在版本控制中
- [ ] 使用强密码和安全的数据库连接
- [ ] 配置 HTTPS
- [ ] 设置适当的 CORS 策略
- [ ] 启用日志记录和监控
- [ ] 定期备份数据库
- [ ] 审查所有 API 路由的权限检查

---

## 审计报告文档

以下文档详细记录了所有安全修复：

1. **P1-GOLDEN-THREE-QUESTIONS-FIX-REPORT.md** - 黄金三问诊断修复报告
2. **P1-FINAL-COMPREHENSIVE-AUDIT-REPORT.md** - 最终彻底底层代码审计报告
3. **P1-LINE-BY-LINE-QUERY-AUDIT-REPORT.md** - 逐行查询语句审计报告
4. **P1-DESTRUCTIVE-HARDCODE-AUDIT-REPORT.md** - 破坏性硬编码排查报告
5. **P1-DATA-ISOLATION-FIX-REPORT.md** - 数据隔离修复报告
6. **DATA-ISOLATION-AUDIT-REPORT.md** - 数据隔离审计报告

---

## 项目结构

```
yesno-app/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   ├── auth/         # 认证相关 API
│   │   ├── admin/        # 管理员 API
│   │   ├── markets/      # 市场相关 API
│   │   ├── orders/       # 订单相关 API
│   │   └── ...
│   ├── admin/            # 管理员页面
│   ├── wallet/           # 钱包页面
│   ├── markets/          # 市场页面
│   └── ...
├── components/            # React 组件
│   ├── providers/       # Context Providers
│   ├── market-detail/   # 市场详情组件
│   └── ...
├── lib/                  # 工具库
│   ├── dbService.ts    # 数据库服务
│   ├── authUtils.ts    # 认证工具
│   └── ...
├── prisma/              # Prisma 配置
│   ├── schema.prisma   # 数据库架构
│   └── migrations/    # 数据库迁移
├── hooks/              # React Hooks
├── types/             # TypeScript 类型定义
└── scripts/           # 工具脚本
```

---

## 关键修复点

### 数据隔离修复
- ✅ 所有用户专属数据查询都强制使用 `WHERE userId = current_user_id`
- ✅ 统一的 `extractUserIdFromToken()` 函数提取用户 ID
- ✅ 所有 DBService 方法都验证 `userId` 是有效的 UUID 格式
- ✅ 拒绝硬编码的 '1' 或 'default' 作为用户 ID

### 前端状态管理修复
- ✅ `AuthProvider.tsx` 强制验证 `currentUser.id` 是有效的 UUID
- ✅ `WalletPage.tsx` 确保在 `currentUser.id` 有效时才发起 API 请求
- ✅ 所有组件都优先使用 API 返回的真实数据

### 管理员功能修复
- ✅ `app/admin/withdrawals/page.tsx` 修复 pagination 错误
- ✅ 管理员路由使用中间件保护
- ✅ 管理员 API 使用独立的认证机制

---

## 测试建议

### 功能测试
1. 用户注册和登录
2. 市场浏览和下注
3. 充值和提现
4. 订单查询和交易历史
5. 管理员功能（市场创建、用户管理、提现审批）

### 安全测试
1. 验证用户只能看到自己的数据
2. 验证无效的 `currentUser.id` 不会导致数据泄漏
3. 验证硬编码的 '1' 或 'default' 被拒绝
4. 验证 UUID 格式验证正常工作

---

## 依赖项

### 主要依赖
- `next` - Next.js 框架
- `react` - React 库
- `prisma` - ORM 数据库工具
- `@prisma/client` - Prisma Client
- `typescript` - TypeScript 支持

### 开发依赖
- `@types/node` - Node.js 类型定义
- `@types/react` - React 类型定义
- `tailwindcss` - CSS 框架
- `postcss` - CSS 处理工具

---

## 联系方式与支持

如有问题或需要帮助，请参考：
- 项目 README.md
- 各审计报告文档
- Prisma 文档：https://www.prisma.io/docs
- Next.js 文档：https://nextjs.org/docs
