# 测试自动化脚本指南

本文档提供了可以自动化执行的测试脚本和命令。

---

## 🔍 自动化安全检查脚本

### 1. 硬编码 Token 检查

```bash
# 检查硬编码 Token
echo "检查硬编码 Token..."
grep -r "ADMIN_SECRET_TOKEN\|SECRET_TOKEN\|API_KEY.*=" app/ components/ lib/ \
  --exclude-dir=node_modules \
  --exclude="*.md" \
  --exclude="*.log"

# 预期结果: 无输出（或只有注释中的引用）
```

### 2. 权限验证检查

```bash
# 检查管理 API 是否都有权限验证
echo "检查管理 API 权限验证..."
for file in app/api/admin/**/*.ts; do
  if grep -q "export.*function.*GET\|export.*function.*POST" "$file"; then
    if ! grep -q "verifyAdminToken\|createUnauthorizedResponse" "$file"; then
      echo "⚠️  警告: $file 可能缺少权限验证"
    fi
  fi
done
```

### 3. Cookie 传输检查

```bash
# 检查前端是否使用 credentials: 'include'
echo "检查前端 Cookie 传输..."
grep -r "fetch.*admin\|fetch.*/api/admin" app/admin/ components/ \
  --include="*.tsx" \
  --include="*.ts" \
  -A 5 | grep -v "credentials.*include" | head -20

# 预期结果: 应该找到使用 credentials: 'include' 的请求
```

### 4. SQL 注入防护检查

```bash
# 检查是否使用 Prisma（自动防止 SQL 注入）
echo "检查 Prisma 使用情况..."
grep -r "prisma\." app/api/ lib/ \
  --include="*.ts" \
  | head -20

# 预期结果: 应该看到 prisma. 调用（使用参数化查询）
```

### 5. XSS 防护检查

```bash
# 检查是否使用 dangerouslySetInnerHTML（可能有 XSS 风险）
echo "检查 XSS 风险..."
grep -r "dangerouslySetInnerHTML" app/ components/ \
  --include="*.tsx" \
  --include="*.ts"

# 预期结果: 无输出或极少使用（需要审查）
```

---

## 🧪 API 测试脚本

### 1. 权限测试

```bash
# 测试未登录访问管理 API（应返回 401）
echo "测试未登录访问管理 API..."
curl -X GET http://localhost:3000/api/admin/markets/review \
  -v 2>&1 | grep -E "HTTP|401|Unauthorized"

# 预期结果: 应看到 401 Unauthorized
```

### 2. 数据隔离测试

```bash
# 测试订单 API 是否正确过滤用户数据
echo "测试订单 API 数据隔离..."
# 需要先登录获取 Cookie，然后测试
# curl -X GET http://localhost:3000/api/orders/user \
#   -H "Cookie: auth_core_session={session_id}" \
#   -v

# 预期结果: 只能看到当前用户的订单
```

---

## 📊 代码质量检查

### 1. TypeScript 编译检查

```bash
echo "检查 TypeScript 编译错误..."
npx tsc --noEmit --skipLibCheck

# 预期结果: 无错误或只有类型定义问题（不影响运行）
```

### 2. ESLint 检查

```bash
echo "运行 ESLint 检查..."
npm run lint

# 预期结果: 无严重错误
```

### 3. 未使用的导入检查

```bash
# 使用 ts-prune 检查未使用的导出（如果安装了）
# npx ts-prune

# 或使用 grep 检查明显的未使用导入
```

---

## 🚀 完整自动化测试脚本

创建一个 `test-automation.sh` 脚本：

```bash
#!/bin/bash

echo "=========================================="
echo "自动化测试执行"
echo "=========================================="
echo ""

# 1. 硬编码 Token 检查
echo "1. 检查硬编码 Token..."
TOKEN_COUNT=$(grep -r "ADMIN_SECRET_TOKEN" app/ components/ lib/ \
  --exclude-dir=node_modules 2>/dev/null | wc -l)
if [ "$TOKEN_COUNT" -eq 0 ]; then
  echo "   ✅ 通过 - 未发现硬编码 Token"
else
  echo "   ⚠️  发现 $TOKEN_COUNT 处硬编码 Token"
fi
echo ""

# 2. 权限验证检查
echo "2. 检查权限验证..."
AUTH_COUNT=$(grep -r "verifyAdminToken" app/api/admin/ \
  --exclude-dir=node_modules 2>/dev/null | wc -l)
if [ "$AUTH_COUNT" -gt 0 ]; then
  echo "   ✅ 通过 - 发现 $AUTH_COUNT 处权限验证"
else
  echo "   ⚠️  未发现权限验证"
fi
echo ""

# 3. Cookie 传输检查
echo "3. 检查 Cookie 传输..."
CRED_COUNT=$(grep -r "credentials.*include\|credentials: 'include'" \
  app/admin/ components/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l)
if [ "$CRED_COUNT" -gt 0 ]; then
  echo "   ✅ 通过 - 发现 $CRED_COUNT 处使用 credentials"
else
  echo "   ⚠️  未发现使用 credentials"
fi
echo ""

# 4. TypeScript 编译检查
echo "4. 检查 TypeScript 编译..."
TS_ERRORS=$(npx tsc --noEmit --skipLibCheck 2>&1 | grep -c "error TS" || echo "0")
if [ "$TS_ERRORS" -eq 0 ]; then
  echo "   ✅ 通过 - 无编译错误"
else
  echo "   ⚠️  发现 $TS_ERRORS 个 TypeScript 错误"
fi
echo ""

echo "=========================================="
echo "自动化测试完成"
echo "=========================================="
```

---

## 📝 使用说明

1. **执行自动化脚本**:
   ```bash
   chmod +x test-automation.sh
   ./test-automation.sh
   ```

2. **查看测试报告**:
   - 自动化检查结果已记录在 `TEST-EXECUTION-RESULT.md`

3. **手动测试**:
   - 在开发环境中手动测试所有功能
   - 使用测试账号进行端到端测试
   - 验证数据隔离

---

**注意**: 自动化测试只能检查代码层面的问题，功能测试和数据隔离测试需要手动执行。

