# 安全性测试用例

**测试日期**: 2025-01-30  
**测试范围**: 关键安全漏洞修复验证

---

## 1. 硬编码 Token 测试

### 测试用例 1.1: 验证硬编码 Token 已移除

**测试步骤**:
1. 打开浏览器 DevTools (F12)
2. 切换到 Network 标签
3. 登录管理员账号
4. 执行需要管理员权限的操作（如创建市场、审核市场）
5. 查看请求头（Headers）

**预期结果**:
- ✅ **不应**看到 `Authorization: Bearer ADMIN_SECRET_TOKEN`
- ✅ 请求应包含 `credentials: 'include'`
- ✅ Cookie 中应包含 `adminToken`（HttpOnly）

**验证方法**:
```bash
# 搜索代码库确认无硬编码 Token
grep -r "ADMIN_SECRET_TOKEN" app/ components/ --exclude-dir=node_modules
# 应该返回 0 个结果
```

---

### 测试用例 1.2: 验证 Token 通过 Cookie 传输

**测试步骤**:
1. 登录管理员账号
2. 打开 DevTools Network 标签
3. 查看任意管理 API 请求的 Cookie 头

**预期结果**:
- ✅ 请求 Cookie 中包含 `adminToken`（HttpOnly）
- ✅ Token 格式应为：`admin-token-{userId}-{timestamp}-{random}`

---

## 2. 权限检查测试

### 测试用例 2.1: 未登录用户访问管理 API

**测试步骤**:
```bash
curl -X GET http://localhost:3000/api/admin/markets/review
```

**预期结果**:
- ✅ 返回 401 Unauthorized
- ✅ 错误信息：`"Unauthorized. Admin access required."`

---

### 测试用例 2.2: 普通用户访问管理 API

**测试步骤**:
1. 使用普通用户账号登录
2. 获取用户 Cookie
3. 使用该 Cookie 访问管理 API：
```bash
curl -X GET http://localhost:3000/api/admin/markets/review \
  -H "Cookie: auth_core_session={session_id}"
```

**预期结果**:
- ✅ 返回 401 或 403
- ✅ 错误信息包含权限相关的提示

---

### 测试用例 2.3: 管理员访问管理 API

**测试步骤**:
1. 使用管理员账号登录
2. 访问 `/api/admin/markets/review`

**预期结果**:
- ✅ 返回 200 OK
- ✅ 返回待审核市场列表

---

### 测试用例 2.4: 验证审核 API 权限检查

**测试步骤**:
1. 未登录状态下，尝试访问：
   - `POST /api/admin/markets/review/batch`
   - `POST /api/admin/markets/{market_id}/review`
   - `DELETE /api/admin/markets/{market_id}/review`

**预期结果**:
- ✅ 所有请求返回 401 Unauthorized
- ✅ 使用 `verifyAdminToken` 进行验证

---

## 3. 数据隔离测试

### 测试用例 3.1: 订单数据隔离

**测试步骤**:
1. 使用用户A登录，创建订单
2. 记录订单ID
3. 使用用户B登录
4. 访问 `/api/orders/user`
5. 验证返回的订单列表

**预期结果**:
- ✅ 用户B的订单列表**不包含**用户A的订单
- ✅ API 使用 `WHERE userId = current_user_id` 过滤

**验证代码位置**:
- `app/api/orders/user/route.ts`
- `lib/dbService.ts` - `findOrdersByUserId`

---

### 测试用例 3.2: 交易记录隔离

**测试步骤**:
1. 使用用户A登录，进行充值/提现
2. 使用用户B登录
3. 访问 `/api/transactions`
4. 验证返回的交易记录

**预期结果**:
- ✅ 用户B的交易记录列表**不包含**用户A的记录
- ✅ API 使用 `WHERE userId = current_user_id` 过滤

**验证代码位置**:
- `app/api/transactions/route.ts`
- `lib/dbService.ts` - `findUserTransactions`

---

### 测试用例 3.3: 余额隔离

**测试步骤**:
1. 使用用户A登录，查看余额
2. 记录余额值
3. 使用用户B登录，查看余额
4. 验证余额值不同

**预期结果**:
- ✅ 每个用户看到自己的余额
- ✅ 余额值正确（从正确的用户记录获取）

**验证代码位置**:
- `app/api/user/assets/route.ts`
- `lib/dbService.ts` - `findUserById`

---

### 测试用例 3.4: 直接访问其他用户数据（如果允许）

**测试步骤**:
1. 用户A登录，获取用户A的ID
2. 使用用户B登录
3. 尝试访问 `/api/users/{userA_id}`

**预期结果**:
- ✅ 如果权限检查正确，应返回 403 或只返回公开信息
- ✅ 不应返回用户A的私有数据（余额、订单等）

---

## 4. SQL 注入测试

### 测试用例 4.1: 输入框 SQL 注入测试

**测试步骤**:
在以下输入框中尝试输入 SQL 注入代码：
- 搜索框：`' OR '1'='1`
- 邮箱输入：`test@test.com' OR '1'='1`
- 市场标题：`'; DROP TABLE markets; --`

**预期结果**:
- ✅ 请求被拒绝或数据被正确转义
- ✅ 数据库不受影响
- ✅ 使用 Prisma 的参数化查询（自动防止 SQL 注入）

**验证方法**:
- 检查 Prisma 查询是否使用参数化查询（所有 Prisma 查询都是参数化的）

---

## 5. XSS 测试

### 测试用例 5.1: 输入框 XSS 测试

**测试步骤**:
在以下输入框中尝试输入 XSS 代码：
- 市场标题：`<script>alert('XSS')</script>`
- 市场描述：`<img src=x onerror=alert('XSS')>`
- 评论内容：`<svg onload=alert('XSS')>`

**预期结果**:
- ✅ 代码被 React 自动转义
- ✅ 浏览器**不执行** JavaScript 代码
- ✅ 显示为纯文本

**验证方法**:
- React 默认转义所有用户输入
- 检查是否有使用 `dangerouslySetInnerHTML`（应该没有或极少使用）

---

## 6. 会话管理测试

### 测试用例 6.1: 会话过期测试

**测试步骤**:
1. 登录账号
2. 等待会话过期（或手动清除 Cookie）
3. 尝试访问受保护的 API

**预期结果**:
- ✅ 返回 401 Unauthorized
- ✅ 提示用户重新登录

---

### 测试用例 6.2: 并发会话测试

**测试步骤**:
1. 在同一浏览器中，打开两个标签页
2. 在标签页A中登录
3. 在标签页B中尝试访问需要登录的页面

**预期结果**:
- ✅ 两个标签页共享同一会话
- ✅ 在标签页B中也能访问需要登录的页面

---

## 7. 文件上传安全测试（如果有）

### 测试用例 7.1: 文件类型验证

**测试步骤**:
1. 尝试上传非允许的文件类型（如 `.exe`, `.php`）
2. 尝试上传大文件（> 10MB）

**预期结果**:
- ✅ 文件类型验证失败
- ✅ 文件大小验证失败
- ✅ 返回错误提示

---

## 8. API 速率限制测试（如果有）

### 测试用例 8.1: 频繁请求测试

**测试步骤**:
1. 快速连续发送多个 API 请求（如 100 个请求/秒）
2. 观察服务器响应

**预期结果**:
- ✅ 如果实施了速率限制，后续请求应返回 429 Too Many Requests
- ✅ 服务器不应崩溃

---

## 9. 敏感信息泄露测试

### 测试用例 9.1: 错误信息泄露

**测试步骤**:
1. 触发一个错误（如访问不存在的资源）
2. 查看错误响应

**预期结果**:
- ✅ 生产环境不应返回详细的错误堆栈
- ✅ 错误信息不应包含敏感信息（数据库密码、API Key等）

---

### 测试用例 9.2: 源代码泄露

**测试步骤**:
1. 尝试访问 `.env` 文件：`http://localhost:3000/.env`
2. 尝试访问源代码：`http://localhost:3000/app/api/orders/route.ts`

**预期结果**:
- ✅ 返回 404 或 403
- ✅ 不应返回文件内容

---

## 10. CORS 测试（如果适用）

### 测试用例 10.1: 跨域请求测试

**测试步骤**:
1. 从不同域名发送 API 请求
2. 检查 CORS 头

**预期结果**:
- ✅ 如果配置了 CORS，应返回正确的 CORS 头
- ✅ 不应允许任意域名的请求（除非是公开 API）

---

## 测试执行检查表

### 准备工作
- [ ] 测试环境已搭建
- [ ] 测试账号已准备（管理员、普通用户）
- [ ] 浏览器 DevTools 已打开

### 测试执行
- [ ] 硬编码 Token 测试（测试用例 1.1, 1.2）
- [ ] 权限检查测试（测试用例 2.1-2.4）
- [ ] 数据隔离测试（测试用例 3.1-3.4）
- [ ] SQL 注入测试（测试用例 4.1）
- [ ] XSS 测试（测试用例 5.1）
- [ ] 会话管理测试（测试用例 6.1, 6.2）

### 测试结果记录
- **通过**: ___ / ___
- **失败**: ___ / ___
- **发现问题**: 

---

**测试完成后，请填写测试结果并记录发现的安全问题。**

