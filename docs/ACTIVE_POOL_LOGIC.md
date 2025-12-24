# 活跃池（Active Pool）逻辑说明

## 📊 活跃池的定义

**活跃池** = 能够实时同步成功的市场（有 `externalId` 的市场）

### 包含条件（OR关系）：
1. `source='POLYMARKET'` 且 `status='OPEN'` 且 `isActive=true` 且 `externalId != null`
   - 手动添加或从 Polymarket 爬取的市场，且能够同步赔率
   
2. `isFactory=true` 且 `status='OPEN'` 且 `isActive=true` 且 `externalId != null`
   - 工厂自动生成的市场，且能够同步赔率

### 不包含：
- `status='CLOSED'` 的市场（已关闭）
- `status='RESOLVED'` 的市场（已结算）
- `status='CANCELED'` 的市场（已取消）
- `isActive=false` 的市场（已删除）
- **`externalId=null` 的市场（无法同步赔率的市场）**

## ✅ 重要理解

**活跃池 = 能够成功同步赔率的市场**

活跃池只统计有 `externalId` 的市场，表示这些市场能够成功从 Polymarket 同步赔率数据。

### 为什么会出现"在活跃池但同步失败"？

#### 场景1：工厂市场没有 externalId
- 市场状态：`status='OPEN'` ✅
- 市场类型：`isFactory=true` ✅
- 但是：`externalId=null` ❌
- **结果**：在活跃池中，但同步失败

#### 场景2：无法匹配 Polymarket 市场
- 尝试自动绑定 `externalId` 失败
- 可能原因：
  - Polymarket 中不存在对应市场
  - 时间窗口不匹配
  - 周期或符号不匹配

## 📈 统计数据说明

### 活跃池统计
- **activePoolSize**: 活跃池总数（能够成功同步的市场数，有 `externalId` 的）
- **factoryCount**: 工厂市场数（在活跃池中的，有 `externalId` 的）
- **manualCount**: 手动市场数（在活跃池中的，有 `externalId` 的）

### 说明
活跃池只统计能够成功同步赔率的市场（有 `externalId` 的市场），所以：
- 所有在活跃池中的市场都能成功同步赔率
- 没有 `externalId` 的市场不会出现在活跃池中

## 🔍 诊断结果解读

根据您提供的诊断结果：

```
总工厂市场: 426
OPEN状态: 302
可以同步赔率的: 0      ← 所有302个OPEN工厂市场都没有externalId
无法同步赔率的: 302    ← 所有OPEN工厂市场都无法同步
状态错误（未来但CLOSED）: 4
状态错误（过去但OPEN）: 0
```

**分析**：
1. ✅ 活跃池显示 326 个（302工厂 + 24手动）- **这是正确的**
2. ❌ 302个工厂市场全部无法同步（externalId都是null）
3. ⚠️ 有4个未来场次被错误标记为CLOSED（需要修复）

## 🛠️ 解决方案

### 步骤1：修复状态错误
```javascript
POST /api/admin/factory/fix-status
```
修复4个未来但CLOSED的市场

### 步骤2：检查为什么无法匹配externalId
查看赔率同步日志，了解 `tryBindExternalId` 失败的原因

### 步骤3：清理无法同步的市场（可选）
如果这些市场确实是历史场次且无法匹配，可以清理：
```javascript
DELETE /api/admin/factory/cleanup
```
这会删除所有 `isFactory=true` 且 `externalId=null` 的市场

### 步骤4：重新生成未来市场
在工厂模板管理页面，点击"生成"按钮，重新生成未来24小时的市场

## 💡 最佳实践

1. **定期生成未来市场**：确保始终有未来24小时的市场
2. **监控同步成功率**：如果成功率持续低于某个阈值，需要检查
3. **及时清理无效数据**：定期清理无法同步的历史市场
4. **修复状态错误**：使用修复API修复状态不一致的市场
