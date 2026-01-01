# 数据清洗计划

**制定时间**: 2025-01-30  
**目标**: 清理测试数据、脏数据，为生产环境做准备

---

## 🔍 需要清洗的数据类型

### 1. 测试用户数据

**识别标准**:
- 邮箱包含 `test`、`demo`、`example` 等关键词
- 邮箱格式为 `test@test.com`、`admin@admin.com` 等
- 创建时间在测试期间的批量用户

**清洗策略**:
- 标记为测试用户（添加 `isTest: true` 标记）
- 或者删除测试用户及其相关数据（订单、持仓、交易记录等）

**风险评估**: 中（需要级联删除相关数据）

---

### 2. 测试市场数据

**识别标准**:
- 标题包含 "测试"、"test"、"demo" 等关键词
- 创建者为测试用户
- 从未有真实交易的测试市场

**清洗策略**:
- 删除测试市场（需要级联删除相关订单、持仓等）
- 或者标记为测试市场，不显示在前端

**风险评估**: 中（需要级联删除相关数据）

---

### 3. 无效订单数据

**识别标准**:
- 金额为 0 或负数的订单
- 状态异常的订单（如状态为 "PENDING" 但已过期）
- 关联的市场已被删除的订单

**清洗策略**:
- 删除无效订单
- 或者修复订单状态

**风险评估**: 低（订单数据通常可以安全删除）

---

### 4. 重复数据

**识别标准**:
- 重复的市场记录（相同的标题和分类）
- 重复的分类记录
- 重复的用户记录（相同的邮箱）

**清洗策略**:
- 合并重复数据
- 删除重复记录（保留最早或最新的）

**风险评估**: 高（需要仔细验证哪些是真正的重复）

---

### 5. 孤立数据

**识别标准**:
- 订单关联的市场不存在
- 持仓关联的市场不存在
- 交易记录关联的用户不存在

**清洗策略**:
- 删除孤立数据
- 或者修复关联关系

**风险评估**: 中（需要确保不会误删有效数据）

---

### 6. 过期/无效的会话数据

**识别标准**:
- `auth_sessions` 表中过期的会话（`expiresAt < now()`）

**清洗策略**:
- 定期清理过期会话（可以设置定时任务）

**风险评估**: 低（过期会话可以安全删除）

---

## 📋 数据清洗脚本示例

### 脚本 1: 识别测试用户

```sql
-- 查找测试用户
SELECT id, email, createdAt 
FROM users 
WHERE email LIKE '%test%' 
   OR email LIKE '%demo%' 
   OR email LIKE '%example%'
   OR email IN ('test@test.com', 'admin@admin.com')
ORDER BY createdAt DESC;
```

### 脚本 2: 识别测试市场

```sql
-- 查找测试市场
SELECT id, title, createdAt 
FROM markets 
WHERE title LIKE '%测试%' 
   OR title LIKE '%test%' 
   OR title LIKE '%demo%'
ORDER BY createdAt DESC;
```

### 脚本 3: 识别孤立订单

```sql
-- 查找关联市场不存在的订单
SELECT o.id, o.marketId, o.userId, o.createdAt
FROM orders o
LEFT JOIN markets m ON o.marketId = m.id
WHERE m.id IS NULL;
```

### 脚本 4: 识别无效订单

```sql
-- 查找金额为 0 或负数的订单
SELECT id, marketId, userId, amount, createdAt
FROM orders
WHERE amount <= 0;
```

---

## 🔧 数据清洗执行步骤

### 步骤 1: 数据备份

**必须在执行任何清洗操作之前完成**:

```bash
# 备份数据库
pg_dump -h localhost -U username -d yesno_db > backup_before_cleanup_$(date +%Y%m%d_%H%M%S).sql
```

---

### 步骤 2: 数据分析

1. 运行识别脚本，统计各类脏数据数量
2. 评估清洗影响范围
3. 确定清洗策略（删除 vs 标记）

---

### 步骤 3: 编写清洗脚本

**建议使用 Prisma 或 SQL 脚本**:

```typescript
// scripts/cleanup-test-data.ts
import { prisma } from '@/lib/prisma';

async function cleanupTestUsers() {
  // 1. 查找测试用户
  const testUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'test' } },
        { email: { contains: 'demo' } },
        { email: { contains: 'example' } },
      ],
    },
  });

  // 2. 删除测试用户及其相关数据（使用事务确保原子性）
  for (const user of testUsers) {
    await prisma.$transaction(async (tx) => {
      // 删除订单
      await tx.order.deleteMany({ where: { userId: user.id } });
      // 删除持仓
      await tx.position.deleteMany({ where: { userId: user.id } });
      // 删除交易记录
      await tx.transaction.deleteMany({ where: { userId: user.id } });
      // 删除用户
      await tx.user.delete({ where: { id: user.id } });
    });
  }
}
```

---

### 步骤 4: 在测试环境执行

1. 在测试环境执行清洗脚本
2. 验证清洗结果
3. 检查数据完整性

---

### 步骤 5: 在生产环境执行（谨慎）

1. 确认清洗脚本已充分测试
2. 选择低峰期执行
3. 实时监控执行过程
4. 验证清洗结果

---

## ⚠️ 注意事项

1. **备份优先**: 永远在清洗前备份数据
2. **测试环境先行**: 所有清洗操作先在测试环境验证
3. **级联删除**: 注意删除用户/市场时的级联删除
4. **事务使用**: 使用数据库事务确保操作的原子性
5. **记录日志**: 记录所有清洗操作的详细信息
6. **分批执行**: 对于大量数据，分批执行，避免长时间锁表

---

## 📊 清洗前后对比

**清洗前统计**:
- 总用户数: ____
- 测试用户数: ____
- 总市场数: ____
- 测试市场数: ____
- 总订单数: ____
- 无效订单数: ____

**清洗后统计**:
- 总用户数: ____
- 测试用户数: ____
- 总市场数: ____
- 测试市场数: ____
- 总订单数: ____
- 无效订单数: ____

---

## 🔄 定期维护

建议设置定期数据清洗任务：

1. **每日清理**: 过期会话
2. **每周清理**: 测试数据
3. **每月清理**: 孤立数据、重复数据

---

**重要**: 数据清洗是高风险操作，务必在测试环境充分验证后再在生产环境执行。

