# 🕵️‍♂️ 提现手续费逻辑分析报告

## 📍 1. 手续费计算位置

### 前端计算（当前实现）
- **文件**：`components/modals/WithdrawModal.tsx`
- **代码位置**：第 45-48 行
- **计算方式**：从配置文件中读取固定的手续费值

```typescript
const networkFee = useMemo(() => {
  const network = availableNetworks.find(n => n.id === selectedNetwork);
  return network ? parseFee(network.fee) : 0;
}, [availableNetworks, selectedNetwork]);
```

### 配置文件位置
- **文件**：`lib/constants/cryptoConfig.ts`
- **定义**：`CRYPTO_CONFIG` 对象

---

## 💰 2. 当前收费规则（硬编码）

### 手续费配置详情

```typescript
CRYPTO_CONFIG = {
  USDT: {
    networks: [
      { id: "TRC20", name: "Tron (TRC20)", fee: "$1.00", arrival: "2 mins" },
      { id: "ERC20", name: "Ethereum (ERC20)", fee: "$5.00", arrival: "5 mins" },
      { id: "BEP20", name: "BNB Smart Chain (BEP20)", fee: "$0.29", arrival: "1 mins" },
      { id: "POLYGON", name: "Polygon", fee: "$0.10", arrival: "3 mins" },
    ],
  },
  USDC: {
    networks: [
      { id: "POLYGON", name: "Polygon", fee: "$0.10", arrival: "3 mins" },
      { id: "ERC20", name: "Ethereum (ERC20)", fee: "$5.00", arrival: "5 mins" },
    ],
  },
}
```

### 📊 手续费一览表

| 币种 | 网络 | 手续费（固定） | 到账时间 |
|------|------|---------------|----------|
| USDT | TRC20 | **$1.00** | 2 分钟 |
| USDT | ERC20 | **$5.00** | 5 分钟 |
| USDT | BEP20 | **$0.29** | 1 分钟 |
| USDT | POLYGON | **$0.10** | 3 分钟 |
| USDC | POLYGON | **$0.10** | 3 分钟 |
| USDC | ERC20 | **$5.00** | 5 分钟 |

### 🔍 关键发现

1. **固定费用**：所有手续费都是**固定金额**，不随提现金额变化
2. **前端计算**：手续费在前端显示和计算，**仅用于展示**
3. **后端未实现**：后端 `/api/withdraw` 接口**没有扣除手续费**，只扣除用户输入的金额
4. **硬编码**：所有手续费值都硬编码在 `cryptoConfig.ts` 文件中

---

## ⚠️ 3. 当前存在的问题

### 问题 1：手续费仅显示，未实际扣除
- 前端显示手续费并计算"实际到账金额"
- 但后端 API 直接扣除用户输入的金额，**没有扣除手续费**
- 这意味着用户实际收到的金额 = 输入金额，而不是"实际到账金额"

### 问题 2：无法动态调整
- 手续费硬编码在代码中
- 每次修改手续费都需要：
  1. 修改代码
  2. 重新部署
  3. 无法根据市场情况实时调整

### 问题 3：管理员无法配置
- 后台管理系统中**没有**手续费配置界面
- 无法通过后台动态调整手续费

---

## 🛠️ 4. 技术改进建议

### 方案 A：数据库配置 + 后端计算（推荐）

#### 步骤 1：创建数据库表

```sql
-- 创建手续费配置表
CREATE TABLE withdrawal_fee_config (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  crypto_type VARCHAR(10) NOT NULL,  -- 'USDT', 'USDC'
  network_id VARCHAR(20) NOT NULL,   -- 'TRC20', 'ERC20', 'BEP20', 'POLYGON'
  fee_type ENUM('FIXED', 'PERCENTAGE') NOT NULL DEFAULT 'FIXED',
  fee_value DECIMAL(10, 2) NOT NULL,  -- 固定金额或百分比（如 0.5 表示 0.5%）
  min_fee DECIMAL(10, 2) DEFAULT 0,   -- 最小手续费（用于百分比类型）
  max_fee DECIMAL(10, 2) DEFAULT NULL, -- 最大手续费（用于百分比类型）
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_crypto_network (crypto_type, network_id)
);
```

#### 步骤 2：创建 Prisma Schema

```prisma
model WithdrawalFeeConfig {
  id          String   @id @default(uuid())
  cryptoType  String   @map("crypto_type")
  networkId   String   @map("network_id")
  feeType     String   @default("FIXED") @map("fee_type") // 'FIXED' | 'PERCENTAGE'
  feeValue    Decimal  @map("fee_value") @db.Decimal(10, 2)
  minFee      Decimal? @map("min_fee") @db.Decimal(10, 2)
  maxFee      Decimal? @map("max_fee") @db.Decimal(10, 2)
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@unique([cryptoType, networkId])
  @@map("withdrawal_fee_config")
}
```

#### 步骤 3：创建 API 接口获取手续费

```typescript
// app/api/wallet/withdraw/fee/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const crypto = searchParams.get('crypto'); // 'USDT' | 'USDC'
  const network = searchParams.get('network'); // 'TRC20' | 'ERC20' | etc.
  const amount = parseFloat(searchParams.get('amount') || '0'); // 可选：提现金额

  if (!crypto || !network) {
    return NextResponse.json(
      { success: false, error: 'crypto 和 network 参数必填' },
      { status: 400 }
    );
  }

  // 查询手续费配置
  const config = await prisma.withdrawalFeeConfig.findUnique({
    where: {
      cryptoType_networkId: {
        cryptoType: crypto,
        networkId: network,
      },
    },
  });

  if (!config || !config.isActive) {
    return NextResponse.json(
      { success: false, error: '未找到手续费配置' },
      { status: 404 }
    );
  }

  // 计算手续费
  let fee = 0;
  if (config.feeType === 'FIXED') {
    fee = Number(config.feeValue);
  } else if (config.feeType === 'PERCENTAGE') {
    fee = (amount * Number(config.feeValue)) / 100;
    // 应用最小/最大手续费限制
    if (config.minFee && fee < Number(config.minFee)) {
      fee = Number(config.minFee);
    }
    if (config.maxFee && fee > Number(config.maxFee)) {
      fee = Number(config.maxFee);
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      fee: fee,
      feeType: config.feeType,
      feeValue: Number(config.feeValue),
      minFee: config.minFee ? Number(config.minFee) : null,
      maxFee: config.maxFee ? Number(config.maxFee) : null,
    },
  });
}
```

#### 步骤 4：修改前端 WithdrawModal

```typescript
// 在 WithdrawModal.tsx 中
const [networkFee, setNetworkFee] = useState(0);
const [feeLoading, setFeeLoading] = useState(false);

// 获取手续费
useEffect(() => {
  const fetchFee = async () => {
    if (!selectedCrypto || !selectedNetwork) return;
    
    setFeeLoading(true);
    try {
      const response = await fetch(
        `/api/wallet/withdraw/fee?crypto=${selectedCrypto}&network=${selectedNetwork}&amount=${amountNum || 0}`
      );
      const result = await response.json();
      if (result.success) {
        setNetworkFee(result.data.fee);
      }
    } catch (error) {
      console.error('获取手续费失败:', error);
    } finally {
      setFeeLoading(false);
    }
  };

  fetchFee();
}, [selectedCrypto, selectedNetwork, amountNum]);
```

#### 步骤 5：修改后端提现 API

```typescript
// 在 app/api/withdraw/route.ts 中
// 在扣除余额之前，计算实际手续费
const feeConfig = await prisma.withdrawalFeeConfig.findUnique({
  where: {
    cryptoType_networkId: {
      cryptoType: body.cryptoType, // 需要前端传递
      networkId: body.networkId,   // 需要前端传递
    },
  },
});

let actualFee = 0;
if (feeConfig && feeConfig.isActive) {
  if (feeConfig.feeType === 'FIXED') {
    actualFee = Number(feeConfig.feeValue);
  } else if (feeConfig.feeType === 'PERCENTAGE') {
    actualFee = (withdrawAmount * Number(feeConfig.feeValue)) / 100;
    if (feeConfig.minFee && actualFee < Number(feeConfig.minFee)) {
      actualFee = Number(feeConfig.minFee);
    }
    if (feeConfig.maxFee && actualFee > Number(feeConfig.maxFee)) {
      actualFee = Number(feeConfig.maxFee);
    }
  }
}

// 扣除余额时，扣除 提现金额 + 手续费
const totalDeduction = withdrawAmount + actualFee;
if (lockedUser.balance < totalDeduction) {
  throw new Error('余额不足（包含手续费）');
}

// 扣除余额
await tx.user.update({
  where: { id: user.id },
  data: {
    balance: { decrement: totalDeduction },
  },
});

// 创建提现记录时，记录手续费
await tx.withdrawal.create({
  data: {
    userId: user.id,
    amount: withdrawAmount,
    fee: actualFee,  // 记录手续费
    targetAddress: targetAddress,
    status: TransactionStatus.PENDING,
    // ... 其他字段
  },
});
```

#### 步骤 6：创建后台管理界面

```typescript
// app/admin/settings/fees/page.tsx
// 创建一个手续费配置管理页面，允许管理员：
// 1. 查看所有网络的手续费配置
// 2. 编辑手续费（固定金额或百分比）
// 3. 启用/禁用某个网络
// 4. 设置最小/最大手续费限制
```

---

### 方案 B：环境变量配置（简单方案）

如果暂时不想做数据库方案，可以先用环境变量：

```env
# .env.local
WITHDRAWAL_FEE_USDT_TRC20=1.00
WITHDRAWAL_FEE_USDT_ERC20=5.00
WITHDRAWAL_FEE_USDT_BEP20=0.29
WITHDRAWAL_FEE_USDT_POLYGON=0.10
WITHDRAWAL_FEE_USDC_POLYGON=0.10
WITHDRAWAL_FEE_USDC_ERC20=5.00
```

然后创建一个 API 接口读取这些值：

```typescript
// app/api/wallet/withdraw/fee/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const crypto = searchParams.get('crypto');
  const network = searchParams.get('network');
  
  const feeKey = `WITHDRAWAL_FEE_${crypto}_${network}`;
  const fee = parseFloat(process.env[feeKey] || '0');
  
  return NextResponse.json({ success: true, data: { fee } });
}
```

**优点**：简单快速
**缺点**：仍然需要修改代码和重新部署才能更新

---

## 📋 5. 实施优先级建议

### 🔴 高优先级（立即修复）
1. **修复后端扣除手续费逻辑**
   - 当前后端没有扣除手续费，这是业务逻辑错误
   - 需要在前端传递手续费信息，后端实际扣除

### 🟡 中优先级（近期实施）
2. **实现数据库配置方案**
   - 创建手续费配置表
   - 实现 API 接口
   - 修改前端从 API 获取手续费

### 🟢 低优先级（后续优化）
3. **创建后台管理界面**
   - 允许管理员动态调整手续费
   - 支持固定金额和百分比两种模式

---

## 📝 6. 总结

### 当前状态
- ✅ 前端显示手续费（固定值，硬编码）
- ❌ 后端未扣除手续费（需要修复）
- ❌ 无法动态配置（需要改进）

### 建议方案
1. **短期**：修复后端扣除手续费逻辑
2. **中期**：实现数据库配置方案
3. **长期**：创建后台管理界面，支持动态调整

### 关键文件
- 前端计算：`components/modals/WithdrawModal.tsx`
- 配置文件：`lib/constants/cryptoConfig.ts`
- 后端 API：`app/api/withdraw/route.ts`（需要修改）

