# ⚡ HTTP Header 大小限制修复总结

**修复时间**：2026-01-02  
**问题**：静态资源 400 Bad Request 错误  
**根本原因**：HTTP Header 过大（超过 Node.js 默认的 16KB 限制）

---

## 🔧 修复方案

### 修改 package.json 启动脚本

**修改前**：
```json
"start": "next start"
```

**修改后**：
```json
"start": "NODE_OPTIONS='--max-http-header-size=65536' next start -p 3000"
```

**关键改进**：
- ✅ `NODE_OPTIONS='--max-http-header-size=65536'` - 将 HTTP Header 大小限制从默认 16KB 提升到 64KB
- ✅ `-p 3000` - 明确指定端口 3000

---

## 📊 为什么需要这个修复？

### 问题分析

1. **默认限制**：Node.js 默认的 HTTP Header 大小限制是 16KB
2. **实际需求**：NextAuth 和其他中间件可能会添加大量 cookies 和 headers
3. **症状**：当 Header 超过 16KB 时，Node.js 会返回 400 Bad Request

### 常见导致 Header 过大的原因

1. **多个 Cookies**：
   - NextAuth session token
   - 其他认证 cookies
   - 分析/追踪 cookies

2. **自定义 Headers**：
   - 中间件添加的 headers
   - 代理服务器添加的 headers

3. **URL 参数**：
   - 长查询字符串
   - 编码后的参数

---

## ✅ 修复效果

### 预期结果

- ✅ 不再出现 400 Bad Request 错误
- ✅ 静态资源（`_next/static/...`）正常加载（200 OK）
- ✅ 所有请求都能正常处理

### 验证步骤

1. **启动服务器**：
   ```bash
   npm start
   ```

2. **测试静态资源**：
   ```bash
   curl -I http://localhost:3000/_next/static/chunks/2117-7a930db66043ac4e.js
   ```
   应该返回 `200 OK`

3. **检查浏览器 Network 标签**：
   - 所有 `_next/static/...` 请求应返回 200
   - 不应出现 400 错误

---

## 🎯 技术细节

### NODE_OPTIONS 环境变量

- **作用**：设置 Node.js 运行时选项
- **--max-http-header-size**：设置 HTTP Header 的最大大小（字节）
- **65536**：64KB（16KB × 4）

### 为什么是 64KB？

- **安全考虑**：足够大以处理正常请求，但不会过大导致安全问题
- **行业标准**：大多数 Web 服务器默认支持 64KB 或更大
- **NextAuth 兼容**：NextAuth 和其他现代框架通常需要更大的 Header 空间

---

## 📝 相关文件

- `package.json` - 启动脚本配置
- `.next/` - 构建输出（已删除并重新构建）

---

**修复状态**：✅ 已完成  
**下一步**：执行 `npm start` 启动服务器并验证修复效果

