# 返佣系统数据库迁移指南

## 概述
本次更新添加了完整的返佣系统，需要执行数据库迁移来更新 Schema。

## 迁移步骤

### 1. 生成 Prisma 迁移文件
```bash
npx prisma migrate dev --name add_referral_system
```

这个命令会：
- 检测 Prisma Schema 的变化
- 创建迁移 SQL 文件
- 应用迁移到数据库
- 重新生成 Prisma Client

### 2. 初始化返佣比例配置（可选）
如果需要设置默认返佣比例，可以运行以下 SQL：

```sql
INSERT INTO system_settings (key, value, "updatedAt")
VALUES ('REFERRAL_COMMISSION_RATE', '0.01', NOW())
ON CONFLICT (key) DO NOTHING;
```

这会设置默认返佣比例为 1%（0.01）。

### 3. 为现有用户生成邀请码（重要！）
如果数据库中已有用户，需要为它们生成邀请码：

```sql
-- 为所有没有邀请码的用户生成随机邀请码
-- 注意：这是一个示例 SQL，实际执行时需要确保生成的代码是唯一的
UPDATE users 
SET "referralCode" = UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT) FROM 1 FOR 8))
WHERE "referralCode" IS NULL;
```

或者使用 Node.js 脚本：

```typescript
import { prisma } from '@/lib/prisma';
import { generateReferralCode } from '@/lib/utils/referral';

async function generateCodesForExistingUsers() {
  const users = await prisma.user.findMany({
    where: { referralCode: null },
  });

  for (const user of users) {
    let code = generateReferralCode();
    let exists = true;
    
    // 确保代码唯一
    while (exists) {
      const existing = await prisma.user.findUnique({
        where: { referralCode: code },
      });
      if (!existing) {
        exists = false;
      } else {
        code = generateReferralCode();
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { referralCode: code },
    });
  }
}

generateCodesForExistingUsers();
```

## Schema 变更说明

### User 表新增字段
- `referralCode`: String? (unique) - 用户的邀请码
- `invitedById`: String? - 邀请人 ID（外键指向 User.id）

### 新增 CommissionLog 表
用于记录每笔返佣交易：
- `id`: String (UUID)
- `beneficiaryId`: String - 受益人 ID（获得返佣的用户）
- `sourceUserId`: String - 来源用户 ID（产生返佣的交易用户）
- `orderId`: String - 关联的订单 ID
- `amount`: Float - 返佣金额
- `type`: String - 返佣类型（默认 'TRADING_REBATE'）
- `createdAt`: DateTime

## 功能验证清单

### Admin 后台
- [ ] 访问 `/admin/referral-settings` 可以设置返佣比例
- [ ] 返佣比例可以保存并生效

### 用户注册
- [ ] 新用户注册时会自动生成邀请码
- [ ] 通过邀请链接注册的用户会关联到邀请人
- [ ] 邀请链接格式：`/register?ref=INVITECODE`

### 订单交易
- [ ] MARKET 订单成交后会自动计算返佣
- [ ] 返佣金额 = 订单金额 × 返佣比例
- [ ] 返佣会实时加到邀请人余额
- [ ] 返佣记录会写入 CommissionLog 表

### 用户返佣页面
- [ ] 访问 `/profile` -> "邀请返佣" 标签
- [ ] 显示用户的邀请码和邀请链接
- [ ] 显示总返佣收益（Total Earnings）
- [ ] 显示已邀请用户数量
- [ ] 显示受邀用户列表及其贡献金额

## 测试场景

1. **场景 1：新用户注册**
   - 用户 A 注册，获得邀请码 ABC12345
   - 用户 B 通过链接 `/register?ref=ABC12345` 注册
   - 验证：用户 B 的 `invitedById` = 用户 A 的 ID

2. **场景 2：交易返佣**
   - 管理员设置返佣比例为 5%
   - 用户 B（被用户 A 邀请）下单 100 USDT
   - 验证：用户 A 余额增加 5 USDT
   - 验证：CommissionLog 表有记录

3. **场景 3：返佣统计**
   - 用户 A 查看返佣页面
   - 验证：Total Earnings 显示正确
   - 验证：已邀请用户列表显示用户 B
   - 验证：用户 B 的贡献金额正确

## 注意事项

1. **迁移顺序**：先执行 Prisma 迁移，再为现有用户生成邀请码
2. **数据一致性**：确保所有用户都有唯一的邀请码
3. **性能优化**：CommissionLog 表已添加索引，查询性能良好
4. **事务安全**：返佣分发使用 Prisma 事务，确保原子性

## 回滚方案

如果需要回滚，执行：

```bash
npx prisma migrate reset
```

⚠️ **警告**：这会删除所有数据！生产环境请谨慎操作。

