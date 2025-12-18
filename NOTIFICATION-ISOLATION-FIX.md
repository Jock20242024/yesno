# 通知系统数据隔离修复报告

## 问题描述

**严重漏洞**：新注册用户能看到数据库中所有未读通知（显示18条），说明通知查询没有按 userId 隔离。

## 根本原因

通知系统使用浏览器级别的 `localStorage`，存储键为 `"pm_notifications"`，这是**全局的**，不是用户级别的。当新用户在同一个浏览器中注册时，会看到之前其他用户留下的通知数据。

## 修复方案

### 1. 基于用户ID的通知隔离

- **修改前**：所有用户共享同一个 `localStorage` 键：`"pm_notifications"`
- **修改后**：每个用户使用独立的存储键：`pm_notifications_${userId}`

### 2. 用户状态变化时的通知清理

#### 登录/注册时：
- 清除旧的全局通知键（`pm_notifications`）
- 清除匿名通知键（`pm_notifications_anonymous`）
- 加载当前用户的通知数据

#### 登出时：
- 清除当前用户的通知数据
- 清除旧的全局通知键

#### 用户切换时：
- 自动清除旧用户的通知数据
- 加载新用户的通知数据

### 3. 修改的文件

1. **`components/providers/NotificationProvider.tsx`**
   - 添加 `useAuth` hook 依赖，获取当前用户ID
   - 将存储键改为基于用户ID：`pm_notifications_${userId}`
   - 监听用户状态变化，自动切换通知数据
   - 在用户登出时清除通知数据

2. **`components/providers/AuthProvider.tsx`**
   - 在 `login()` 函数中清除旧通知数据
   - 在 `logout()` 函数中清除当前用户的通知数据

### 4. 清理脚本

创建了 `scripts/cleanup-notifications.js` 脚本，用于清理浏览器中可能存在的旧通知数据。

**使用方法**：
```javascript
// 在浏览器控制台中运行
// 或者将脚本内容复制到控制台执行
```

## 验证标准

✅ **新用户注册后，铃铛显示为 0**
✅ **用户A登录时，只能看到用户A的通知**
✅ **用户B登录时，只能看到用户B的通知，看不到用户A的通知**
✅ **用户登出后，通知数据被清除**
✅ **用户切换时，通知数据自动切换**

## 技术细节

### 存储键命名规则

- **已登录用户**：`pm_notifications_${userId}`（例如：`pm_notifications_123e4567-e89b-12d3-a456-426614174000`）
- **未登录用户**：`pm_notifications_anonymous`（但通常会被清除）
- **旧全局键**：`pm_notifications`（已废弃，会在登录/登出时清除）

### 数据隔离机制

1. **用户登录时**：
   ```typescript
   // 清除旧通知
   localStorage.removeItem('pm_notifications');
   localStorage.removeItem('pm_notifications_anonymous');
   
   // 加载当前用户的通知
   const storageKey = `pm_notifications_${userId}`;
   const notifications = JSON.parse(localStorage.getItem(storageKey) || '[]');
   ```

2. **用户登出时**：
   ```typescript
   // 清除当前用户的通知
   localStorage.removeItem(`pm_notifications_${userId}`);
   localStorage.removeItem('pm_notifications');
   ```

3. **用户切换时**：
   ```typescript
   // 自动检测用户ID变化
   useEffect(() => {
     if (userId !== currentUserId) {
       // 清除旧用户的通知
       localStorage.removeItem(`pm_notifications_${currentUserId}`);
       // 加载新用户的通知
       const newKey = `pm_notifications_${userId}`;
       // ...
     }
   }, [userId]);
   ```

## 向后兼容

- 保留了清理旧全局通知键的逻辑，确保向后兼容
- 新用户首次登录时，会自动清除可能存在的旧通知数据

## 注意事项

⚠️ **重要**：此修复仅影响前端通知系统。如果未来需要后端通知系统，需要：
1. 创建数据库通知表（包含 `userId` 字段）
2. 在查询时强制添加 `WHERE userId = currentUserId` 条件
3. 处理全局广播通知的逻辑（如果需要）

## 修复完成时间

2024-12-XX

## 修复人员

AI Assistant (Cursor)
