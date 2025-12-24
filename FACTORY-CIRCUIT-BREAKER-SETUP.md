# 自动化工厂 - 运行监控与熔断面板

## 功能概述

本次更新为自动化工厂添加了运行监控、熔断逻辑和手动干预功能。

---

## 1. Schema 更新

### 新增字段

在 `MarketTemplate` 模型中添加了以下字段：

- `status`: String (默认 "ACTIVE") - 模版状态：ACTIVE（运行中）、PAUSED（已熔断）
- `failureCount`: Int (默认 0) - 连续失败计数（用于熔断逻辑）
- `priceOffset`: Float (默认 0.0) - 行权价偏移量（允许运营调整盘口的博弈难度）
- `pauseReason`: String? - 熔断原因（如 "由于数据源丢失已自动熔断"）

### 运行迁移

**重要**: 在部署前必须运行数据库迁移：

```bash
npx prisma migrate dev --name add_factory_circuit_breaker_fields
npx prisma generate
```

---

## 2. 核心功能

### 2.1 熔断逻辑 (`lib/factory/engine.ts`)

**触发条件**:
- 当新市场生成后尝试绑定 `externalId` 失败时，记录一次失败计数
- 连续失败 3 次后，自动将模版状态设为 `PAUSED`
- 同时设置 `isActive = false` 和 `pauseReason = '由于数据源丢失已自动熔断'`

**重置条件**:
- 成功绑定 `externalId` 后，失败计数自动重置为 0

### 2.2 ExternalId 绑定

**绑定逻辑**:
- 创建市场后，尝试从 Polymarket API 搜索匹配的市场
- 搜索关键词：`{symbol} {period}min`
- 如果找到匹配的市场，将其 ID 保存为 `externalId`

### 2.3 行权价偏移量

**功能说明**:
- 允许运营在创建市场时调整行权价
- 最终行权价 = Oracle 价格 + 偏移量
- 正数表示提高行权价，负数表示降低行权价

---

## 3. API 接口

### 3.1 工厂统计 API

**路径**: `GET /api/admin/factory/stats`

**返回数据**:
```json
{
  "success": true,
  "data": {
    "activeTemplates": 5,      // 运行中的模版数量
    "todayGenerated": 120,     // 今日生成总数
    "pausedTemplates": 2,      // 异常熔断数
    "totalTemplates": 7        // 总模版数
  }
}
```

### 3.2 手动触发 API

**路径**: `POST /api/admin/factory/templates/[template_id]/trigger`

**功能**: 立即触发指定模版生成下一期市场

**返回数据**:
```json
{
  "success": true,
  "message": "市场创建成功",
  "data": {
    "marketId": "...",
    "templateId": "..."
  }
}
```

### 3.3 模版管理 API

**路径**: 
- `GET /api/admin/factory/templates/[template_id]` - 获取模版详情
- `PUT /api/admin/factory/templates/[template_id]` - 更新模版（包括 priceOffset）

---

## 4. 前端 UI

### 4.1 运行状态监控卡片组

**位置**: 在"模板列表"上方

**显示指标**:
1. **运行中的模版**: 显示 `status = ACTIVE` 且 `isActive = true` 的模版数量
2. **今日生成总数**: 显示今天创建的 INTERNAL 市场数量
3. **异常熔断数**: 显示 `status = PAUSED` 的模版数量

**刷新频率**: 每 3 秒自动刷新

### 4.2 模板列表增强

**新增列**:
- **失败计数**: 显示 `failureCount/3`，颜色标识（>=3 为红色）
- **状态**: 显示模版状态（激活/停用/已熔断）
  - 已熔断的模版会显示红色背景和熔断原因

**操作按钮**:
- **立即生成**: 手动触发生成下期市场（已熔断的模版无法触发）
- **编辑**: 跳转到编辑页面
- **暂停/激活**: 切换模版激活状态

### 4.3 模版编辑页面

**路径**: `/admin/factory/templates/[template_id]/edit`

**新增字段**:
- **行权价偏移量**: 数字输入框，支持小数（如 0.5、-0.3）
- 提示文字：允许运营调整盘口的博弈难度

---

## 5. 使用流程

### 5.1 正常流程

```
1. 模版自动运行（每周期创建市场）
2. 创建市场后尝试绑定 externalId
3. 绑定成功 → 重置失败计数
4. 绑定失败 → 失败计数 +1
5. 连续失败 3 次 → 自动熔断（status = PAUSED）
```

### 5.2 手动干预

**场景**: 模版已熔断，需要人工补救

**步骤**:
1. 在监控面板查看熔断的模版
2. 点击"立即生成"按钮手动触发
3. 如果仍失败，检查 externalId 绑定逻辑
4. 修复问题后，手动重置模版状态（编辑页面）

### 5.3 调整博弈难度

**场景**: 需要调整某个模版的行权价

**步骤**:
1. 点击模版列表中的"编辑"按钮
2. 修改"行权价偏移量"字段（如：0.5 表示提高 $0.5，-0.3 表示降低 $0.3）
3. 保存后，下次生成市场时会应用偏移量

---

## 6. 代码文件清单

### 后端

- `lib/factory/engine.ts` - 工厂引擎（熔断逻辑、externalId 绑定）
- `app/api/admin/factory/stats/route.ts` - 统计 API
- `app/api/admin/factory/templates/[template_id]/trigger/route.ts` - 手动触发 API
- `app/api/admin/factory/templates/[template_id]/route.ts` - 模版管理 API（GET/PUT）

### 前端

- `app/admin/(protected)/factory/page.tsx` - 工厂主页面（监控面板、列表）
- `app/admin/(protected)/factory/templates/[template_id]/edit/page.tsx` - 模版编辑页面

### Schema

- `prisma/schema.prisma` - MarketTemplate 模型新增字段

---

## 7. 注意事项

1. **数据库迁移**: 部署前必须运行 `npx prisma migrate dev`
2. **兼容性**: 代码已兼容旧数据（没有新字段的模版）
3. **熔断阈值**: 当前设置为连续失败 3 次，可在 `lib/factory/engine.ts` 中修改 `FAILURE_THRESHOLD` 常量
4. **ExternalId 绑定**: 如果 Polymarket API 返回格式变化，可能需要调整 `tryBindExternalId` 函数

---

## 8. 后续优化建议

1. **熔断恢复**: 添加自动恢复机制（如：一段时间后自动重试）
2. **通知机制**: 熔断时发送通知给管理员
3. **历史记录**: 记录每次创建市场和绑定的详细日志
4. **批量操作**: 支持批量重置熔断的模版
