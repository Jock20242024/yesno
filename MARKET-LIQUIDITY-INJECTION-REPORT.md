# 市场流动性注入专项审计报告

**生成时间**: 2025年1月5日  
**审计范围**: 手动创建市场、自动化工厂市场、流动性注入机制  
**审计目标**: 验证流动性注入的真实性、自动化程度和运营瓶颈

---

## 执行摘要

### 核心发现

1. **手动创建市场的"平台启动资金"字段目前仅为展示字段，未实现真实资金划转**
2. **自动化工厂市场创建时，存在"虚拟流动性"设置，但未从系统账户扣减余额**
3. **系统缺少统一的流动性注入机制，存在严重的运营瓶颈**

### 风险等级

- **高风险**: 手动创建市场的流动性注入功能缺失
- **中风险**: 自动化市场创建时流动性注入不完整
- **低风险**: 运营后台缺少批量流动性管理功能

---

## 一、手动创建市场的"真实性"核查

### 1.1 前端实现分析

**文件位置**: `app/admin/(protected)/markets/create/page.tsx`

**关键代码片段**:
```525:549:app/admin/(protected)/markets/create/page.tsx
{/* 平台启动资金 */}
<div>
  <label htmlFor="initialLiquidity" className="block text-sm font-medium text-[#111418] dark:text-white mb-2">
    平台启动资金 ($)
  </label>
  <div className="relative">
    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
      <DollarSign className="w-5 h-5 text-[#D4AF37] dark:text-[#ec9c13]" />
    </div>
    <input
      type="number"
      id="initialLiquidity"
      name="initialLiquidity"
      value={formData.initialLiquidity}
      onChange={handleChange}
      min="0"
      step="0.01"
      className="block w-full pl-12 pr-4 py-2.5 border-2 border-[#D4AF37] dark:border-[#ec9c13] rounded-lg bg-white dark:bg-[#101822] text-[#111418] dark:text-white placeholder-[#9da8b9] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] dark:focus:ring-[#ec9c13] focus:ring-opacity-50 sm:text-sm"
      placeholder="例如：10000"
    />
  </div>
  <p className="mt-2 text-xs text-[#637588] dark:text-[#9da8b9]">
    该金额将作为市场初期的流动性，确保首批用户能够顺利下单。这笔钱越多，市场的抗波动能力（深度）就越强。
  </p>
</div>
```

**前端提交逻辑**:
```192:209:app/admin/(protected)/markets/create/page.tsx
const response = await fetch("/api/admin/markets", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  credentials: 'include',
  body: JSON.stringify({
    title: formData.marketName,
    description: formData.description,
    category: categoryName,
    categories: validCategoryIds,
    isHot: formData.isHot,
    endTime: endTime,
    imageUrl: formData.coverImageUrl || undefined,
    sourceUrl: formData.oracleUrl || undefined,
    feeRate: parseFloat(formData.feeRate) || 0.05,
  }),
});
```

**关键发现**:
- ❌ **`initialLiquidity` 字段未包含在提交的 JSON body 中**
- ❌ **前端表单收集了该字段，但提交时被忽略**

### 1.2 后端实现分析

**文件位置**: `app/api/admin/markets/route.ts`

**关键代码片段**:
```894:1127:app/api/admin/markets/route.ts
export async function POST(request: Request) {
  try {
    // 权限校验...
    const body = await request.json();
    
    const {
      title,
      description,
      category,
      categories,
      endTime,
      imageUrl,
      sourceUrl,
      resolutionCriteria,
      feeRate,
      isHot,
    } = body;
    
    // ... 验证和创建逻辑 ...
    
    const newMarket = await prisma.markets.create({
      data: marketData,
    });
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Market created successfully.',
      marketId: newMarket.id,
      data: JSON.parse(JSON.stringify(newMarket, (k, v) => typeof v === 'bigint' ? v.toString() : v)) 
    }), { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    // 错误处理...
  }
}
```

**关键发现**:
- ❌ **后端 API 未接收 `initialLiquidity` 参数**
- ❌ **市场创建时未从流动性账户（Liquidity Provider）扣减余额**
- ❌ **未创建 `LiquidityPosition` 记录（如果存在该表）**
- ❌ **未创建 `Transaction` 记录记录资金流向**
- ❌ **仅更新了 `markets` 表的字段，未涉及账户余额变动**

### 1.3 数据库操作验证

**实际发生的数据库操作**:

```pseudocode
// 当管理员输入 $10,000 并提交时，实际执行的操作：

1. INSERT INTO markets (
     id, title, description, closingDate, status, 
     totalVolume, totalYes, totalNo, feeRate, ...
   ) VALUES (
     'uuid', '市场名称', '描述', '2025-01-10', 'OPEN',
     0, 0, 0, 0.05, ...
   );

2. INSERT INTO market_categories (
     id, marketId, categoryId
   ) VALUES (
     'uuid', 'market-uuid', 'category-uuid'
   );

// ❌ 未执行的操作：
// - 未从 users 表中 system.liquidity@yesno.com 账户扣减余额
// - 未创建 transactions 记录
// - 未创建 liquidity_positions 记录（如果存在）
// - 未更新 markets 表的 totalYes/totalNo 字段（仍为 0）
```

### 1.4 结论

**问题**: 手动创建市场的"平台启动资金"输入框目前**仅是一个展示字段**，没有实现真实的资金划转逻辑。

**影响**:
- 管理员输入 $10,000 后，系统仅在 `markets` 表中创建了一条记录
- 流动性账户（`system.liquidity@yesno.com`）的余额**未发生任何变动**
- 市场创建后，`totalYes` 和 `totalNo` 仍为 0，无法提供真实的流动性深度
- 用户下单时可能面临流动性不足的问题

---

## 二、自动化市场的流动性注入方案

### 2.1 工厂市场创建流程分析

**文件位置**: `lib/factory/engine.ts`

**关键代码片段**:
```799:832:lib/factory/engine.ts
// 🚀 核心逻辑：如果市场尚未有用户交易（totalVolume === 0）且能解析出概率，重置 AMM Pool
if (currentMarket.totalVolume === 0 && yesProbability !== null) {
  const INITIAL_LIQUIDITY = 1000; // 初始流动性
  const yesProb = yesProbability / 100; // 转换为 0-1 的概率（例如 75% -> 0.75）
  
  // 🚀 根据恒定乘积公式反推：
  // Price(Yes) = totalYes / (totalYes + totalNo) = yesProb
  // 总流动性 L = totalYes + totalNo = INITIAL_LIQUIDITY
  // 因此：totalYes = L * yesProb, totalNo = L * (1 - yesProb)
  const calculatedYes = INITIAL_LIQUIDITY * yesProb;
  const calculatedNo = INITIAL_LIQUIDITY * (1 - yesProb);

  updateData.totalYes = calculatedYes;
  updateData.totalNo = calculatedNo;
}
```

**关键发现**:
- ✅ **工厂市场创建时，会设置初始流动性（`INITIAL_LIQUIDITY = 1000`）**
- ❌ **但这是"虚拟流动性"，仅更新了 `markets.totalYes` 和 `markets.totalNo` 字段**
- ❌ **未从流动性账户（`system.liquidity@yesno.com`）扣减余额**
- ❌ **未创建 `Transaction` 记录记录资金流向**
- ❌ **如果流动性账户余额不足，系统不会报错，允许"空头创建"**

### 2.2 自动化流动性注入的缺失

**当前实现的问题**:

1. **虚拟流动性 vs 真实流动性**:
   - 系统仅更新了市场的 `totalYes` 和 `totalNo` 字段
   - 但流动性账户的余额未发生变动
   - 这导致市场显示有流动性，但实际账户中没有对应的资金支撑

2. **金库余额检查缺失**:
   - 如果流动性账户余额为 $0，系统仍会创建市场并设置虚拟流动性
   - 没有余额不足的报错机制
   - 存在"空头创建"的风险

3. **资金流向不可追溯**:
   - 没有 `Transaction` 记录记录流动性注入
   - 无法在"资金流水"表中看到流动性注入的记录
   - 对账时无法验证流动性来源

### 2.3 技术方案建议

#### 方案 A: 全局默认注入额度（推荐）

**实现逻辑**:

```pseudocode
// 在 createMarketFromTemplate 函数中，市场创建成功后：

IF (市场创建成功 AND 市场状态为 OPEN) THEN
  // 1. 获取全局默认注入额度（从系统设置读取，默认 $500）
  DEFAULT_LIQUIDITY = getSystemSetting('DEFAULT_MARKET_LIQUIDITY') || 500;
  
  // 2. 检查流动性账户余额
  liquidityAccount = getSystemAccount('system.liquidity@yesno.com');
  
  IF (liquidityAccount.balance < DEFAULT_LIQUIDITY) THEN
    // 余额不足，记录警告但不阻止市场创建
    logWarning('流动性账户余额不足，市场创建成功但未注入流动性');
    RETURN marketId;
  END IF;
  
  // 3. 从流动性账户扣减余额
  BEGIN TRANSACTION;
    UPDATE users 
    SET balance = balance - DEFAULT_LIQUIDITY 
    WHERE email = 'system.liquidity@yesno.com';
    
    // 4. 更新市场的 totalYes 和 totalNo（根据初始概率分配）
    initialYesProb = 0.5; // 默认 50/50
    calculatedYes = DEFAULT_LIQUIDITY * initialYesProb;
    calculatedNo = DEFAULT_LIQUIDITY * (1 - initialYesProb);
    
    UPDATE markets 
    SET totalYes = calculatedYes, totalNo = calculatedNo 
    WHERE id = marketId;
    
    // 5. 创建 Transaction 记录
    INSERT INTO transactions (
      id, userId, amount, type, reason, status
    ) VALUES (
      uuid(), liquidityAccount.id, -DEFAULT_LIQUIDITY, 
      'LIQUIDITY_INJECTION', '自动化市场初始流动性注入', 'COMPLETED'
    );
  COMMIT TRANSACTION;
END IF;
```

**配置方式**:
- 在 `system_settings` 表中添加 `DEFAULT_MARKET_LIQUIDITY` 配置项
- 默认值为 $500，可在运营后台修改

**优势**:
- ✅ 自动化程度高，无需人工干预
- ✅ 统一的注入逻辑，便于管理
- ✅ 资金流向可追溯（通过 Transaction 记录）

**劣势**:
- ⚠️ 如果流动性账户余额不足，市场仍会创建（仅记录警告）
- ⚠️ 需要确保流动性账户有足够的资金

#### 方案 B: 模板级配置注入额度

**实现逻辑**:
- 在 `market_templates` 表中添加 `defaultLiquidity` 字段
- 每个模板可以配置不同的默认注入额度
- 市场创建时，使用模板配置的额度

**优势**:
- ✅ 更灵活，不同模板可以有不同的流动性需求
- ✅ 可以根据市场类型（15分钟 vs 1天）设置不同的额度

**劣势**:
- ⚠️ 配置复杂度较高
- ⚠️ 需要为每个模板单独配置

#### 方案 C: 余额不足时的处理策略

**策略 1: 阻止创建（严格模式）**
```pseudocode
IF (liquidityAccount.balance < DEFAULT_LIQUIDITY) THEN
  THROW ERROR('流动性账户余额不足，无法创建市场');
END IF;
```

**策略 2: 允许创建但记录警告（宽松模式，当前推荐）**
```pseudocode
IF (liquidityAccount.balance < DEFAULT_LIQUIDITY) THEN
  logWarning('流动性账户余额不足，市场创建成功但未注入流动性');
  // 市场仍会创建，但 totalYes 和 totalNo 保持为 0
  RETURN marketId;
END IF;
```

**策略 3: 部分注入（折中模式）**
```pseudocode
IF (liquidityAccount.balance < DEFAULT_LIQUIDITY) THEN
  // 注入可用余额（最多注入账户余额）
  actualLiquidity = MIN(DEFAULT_LIQUIDITY, liquidityAccount.balance);
  // 执行部分注入逻辑...
END IF;
```

**推荐**: 使用**策略 2（宽松模式）**，因为：
- 市场创建不应该因为流动性不足而失败
- 管理员可以在市场创建后手动补充流动性
- 系统可以记录警告，提醒管理员补充资金

---

## 三、运营后台功能扩展建议

### 3.1 "一键补流"功能评估

**需求**: 在"市场管理"列表页增加"注入/撤回流动性"按钮

**技术难度**: **中等**

**实现方案**:

#### 方案 A: 复用 SYSTEM_INJECTION 逻辑（推荐）

**文件位置**: `app/api/admin/system-accounts/route.ts`

**现有逻辑**:
```typescript
// 现有的系统账户注入/提取逻辑
POST /api/admin/system-accounts
{
  accountType: 'LIQUIDITY', // 'FEE' | 'AMM' | 'LIQUIDITY'
  action: 'deposit', // 'deposit' | 'withdraw'
  amount: 1000,
  reason: '补充资金'
}
```

**扩展方案**:
```typescript
// 新增市场级流动性注入 API
POST /api/admin/markets/[market_id]/liquidity
{
  action: 'inject', // 'inject' | 'withdraw'
  amount: 1000,
  reason: '市场启动资金注入'
}
```

**实现逻辑**:

```pseudocode
// 1. 验证管理员权限
IF (NOT isAdmin) THEN
  RETURN 401 Unauthorized;
END IF;

// 2. 验证市场存在且状态为 OPEN
market = getMarketById(marketId);
IF (market.status !== 'OPEN') THEN
  RETURN 400 Bad Request('只能为 OPEN 状态的市场注入流动性');
END IF;

// 3. 获取流动性账户
liquidityAccount = getSystemAccount('system.liquidity@yesno.com');

// 4. 执行注入/撤回操作
BEGIN TRANSACTION;
  IF (action === 'inject') THEN
    // 检查余额
    IF (liquidityAccount.balance < amount) THEN
      RETURN 400 Bad Request('流动性账户余额不足');
    END IF;
    
    // 从流动性账户扣减
    UPDATE users 
    SET balance = balance - amount 
    WHERE id = liquidityAccount.id;
    
    // 更新市场的 totalYes 和 totalNo（按当前概率分配）
    currentYesProb = market.totalYes / (market.totalYes + market.totalNo);
    IF (currentYesProb === 0 OR isNaN(currentYesProb)) THEN
      currentYesProb = 0.5; // 默认 50/50
    END IF;
    
    newYes = market.totalYes + (amount * currentYesProb);
    newNo = market.totalNo + (amount * (1 - currentYesProb));
    
    UPDATE markets 
    SET totalYes = newYes, totalNo = newNo 
    WHERE id = marketId;
    
    // 创建 Transaction 记录
    INSERT INTO transactions (
      id, userId, amount, type, reason, status
    ) VALUES (
      uuid(), liquidityAccount.id, -amount, 
      'LIQUIDITY_INJECTION', reason, 'COMPLETED'
    );
    
  ELSE IF (action === 'withdraw') THEN
    // 检查市场可用流动性
    totalLiquidity = market.totalYes + market.totalNo;
    IF (totalLiquidity < amount) THEN
      RETURN 400 Bad Request('市场可用流动性不足');
    END IF;
    
    // 按比例撤回
    currentYesProb = market.totalYes / totalLiquidity;
    withdrawYes = amount * currentYesProb;
    withdrawNo = amount * (1 - currentYesProb);
    
    // 更新市场
    UPDATE markets 
    SET totalYes = totalYes - withdrawYes, 
        totalNo = totalNo - withdrawNo 
    WHERE id = marketId;
    
    // 退回流动性账户
    UPDATE users 
    SET balance = balance + amount 
    WHERE id = liquidityAccount.id;
    
    // 创建 Transaction 记录
    INSERT INTO transactions (
      id, userId, amount, type, reason, status
    ) VALUES (
      uuid(), liquidityAccount.id, amount, 
      'LIQUIDITY_WITHDRAWAL', reason, 'COMPLETED'
    );
  END IF;
COMMIT TRANSACTION;

RETURN 200 OK;
```

**前端实现**:

```typescript
// 在市场管理列表页添加操作按钮
<button 
  onClick={() => handleLiquidityAction(market.id, 'inject')}
  className="btn-primary"
>
  注入流动性
</button>

<button 
  onClick={() => handleLiquidityAction(market.id, 'withdraw')}
  className="btn-secondary"
>
  撤回流动性
</button>

// 处理函数
const handleLiquidityAction = async (marketId: string, action: 'inject' | 'withdraw') => {
  const amount = prompt(`请输入${action === 'inject' ? '注入' : '撤回'}金额（USD）:`);
  if (!amount || parseFloat(amount) <= 0) return;
  
  const response = await fetch(`/api/admin/markets/${marketId}/liquidity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      action,
      amount: parseFloat(amount),
      reason: `${action === 'inject' ? '注入' : '撤回'}流动性 - 手动操作`
    })
  });
  
  const data = await response.json();
  if (data.success) {
    toast.success(`流动性${action === 'inject' ? '注入' : '撤回'}成功`);
    refreshMarketList();
  } else {
    toast.error(data.error || '操作失败');
  }
};
```

**技术难度评估**:
- ✅ **数据库操作**: 简单（复用现有 Transaction 逻辑）
- ✅ **权限验证**: 简单（复用现有 admin 验证逻辑）
- ✅ **前端 UI**: 中等（需要添加按钮和弹窗）
- ✅ **测试复杂度**: 中等（需要测试余额不足、市场状态等边界情况）

**总体评估**: **中等难度**，预计开发时间 2-3 天

#### 方案 B: 批量操作功能

**需求**: 支持批量选择多个市场，一键注入流动性

**实现逻辑**:
```typescript
POST /api/admin/markets/batch-liquidity
{
  marketIds: ['uuid1', 'uuid2', 'uuid3'],
  action: 'inject',
  amountPerMarket: 500, // 每个市场注入的金额
  reason: '批量补充流动性'
}
```

**优势**:
- ✅ 提高运营效率
- ✅ 适合新市场批量上线场景

**劣势**:
- ⚠️ 需要确保流动性账户有足够余额
- ⚠️ 需要处理部分成功、部分失败的情况

---

## 四、总结与建议

### 4.1 核心问题总结

1. **手动创建市场的流动性注入功能缺失**
   - 前端有输入框，但未提交到后端
   - 后端未实现资金划转逻辑
   - **风险**: 管理员误以为已注入流动性，实际市场没有深度

2. **自动化市场创建的流动性注入不完整**
   - 仅设置了虚拟流动性（更新 totalYes/totalNo）
   - 未从流动性账户扣减余额
   - 未创建 Transaction 记录
   - **风险**: 资金流向不可追溯，对账困难

3. **运营后台缺少流动性管理功能**
   - 无法为已创建的市场补充流动性
   - 无法撤回市场的流动性
   - **风险**: 运营效率低，无法灵活调整市场深度

### 4.2 优先级建议

**P0（紧急）**:
1. ✅ 修复手动创建市场的流动性注入功能
   - 前端提交 `initialLiquidity` 参数
   - 后端实现资金划转逻辑
   - 创建 Transaction 记录

**P1（重要）**:
2. ✅ 实现自动化市场的真实流动性注入
   - 从流动性账户扣减余额
   - 创建 Transaction 记录
   - 添加余额不足的警告机制

3. ✅ 实现"一键补流"功能
   - 市场管理列表页添加操作按钮
   - 实现注入/撤回流动性 API
   - 支持按当前概率分配流动性

**P2（优化）**:
4. ⚠️ 实现全局默认注入额度配置
   - 在系统设置中添加配置项
   - 工厂市场创建时自动注入

5. ⚠️ 实现批量流动性管理功能
   - 支持批量选择市场
   - 一键注入/撤回流动性

### 4.3 实施建议

**阶段一（1-2周）**:
- 修复手动创建市场的流动性注入功能
- 实现"一键补流"功能

**阶段二（2-3周）**:
- 实现自动化市场的真实流动性注入
- 添加余额不足的警告机制

**阶段三（可选）**:
- 实现全局默认注入额度配置
- 实现批量流动性管理功能

---

## 附录

### A. 相关文件清单

- `app/admin/(protected)/markets/create/page.tsx` - 手动创建市场页面
- `app/api/admin/markets/route.ts` - 市场创建 API
- `lib/factory/engine.ts` - 工厂市场创建引擎
- `app/api/admin/system-accounts/route.ts` - 系统账户管理 API
- `prisma/schema.prisma` - 数据库 Schema

### B. 数据库表结构

**markets 表**:
- `totalYes` (Float) - YES 选项总金额
- `totalNo` (Float) - NO 选项总金额
- `totalVolume` (Float) - 总交易量

**users 表**:
- `balance` (Float) - 账户余额
- `email` (String) - 系统账户邮箱（如 `system.liquidity@yesno.com`）

**transactions 表**:
- `userId` (String) - 用户ID
- `amount` (Float) - 交易金额（正数为收入，负数为支出）
- `type` (TransactionType) - 交易类型（`LIQUIDITY_INJECTION` / `LIQUIDITY_WITHDRAWAL`）
- `reason` (String) - 交易原因
- `status` (TransactionStatus) - 交易状态

### C. 关键代码位置

1. **手动创建市场 API**: `app/api/admin/markets/route.ts:894-1140`
2. **工厂市场创建**: `lib/factory/engine.ts:1081-1504`
3. **系统账户管理**: `app/api/admin/system-accounts/route.ts`
4. **前端创建表单**: `app/admin/(protected)/markets/create/page.tsx:152-239`

---

**报告结束**

