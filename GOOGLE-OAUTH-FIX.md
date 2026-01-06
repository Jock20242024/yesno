# Google OAuth 登录修复指南

## 错误分析

错误代码：`401: invalid_client` - "The OAuth client was not found"

这个错误通常表示：
1. **GOOGLE_CLIENT_ID 不正确或不完整**
2. **GOOGLE_CLIENT_SECRET 不正确**
3. **Client ID 和 Secret 不匹配**
4. **环境变量中包含空格或特殊字符**

## 立即检查清单

### 1. 检查 Vercel 环境变量

在 Vercel 项目设置中，确保以下环境变量：

```
GOOGLE_CLIENT_ID=755756245858-xxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
```

**重要提示：**
- ✅ **不要包含多余的空格**（值的前后不要有空格）
- ✅ **不要包含引号**（直接输入值，不要用引号包裹）
- ✅ **确保 Client ID 完整**（应该以 `.apps.googleusercontent.com` 结尾）
- ✅ **确保 Client Secret 完整**（应该以 `GOCSPX-` 开头）

### 2. 验证 Google Cloud Console 配置

#### 2.1 检查 OAuth 2.0 客户端 ID

1. 访问 [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. 找到您的 OAuth 2.0 客户端 ID
3. 确认 Client ID 格式：`755756245858-xxxxxxxxxx.apps.googleusercontent.com`
4. 确认 Client Secret 格式：`GOCSPX-xxxxxxxxxxxx`

#### 2.2 确认已授权的重定向 URI

在 Google Cloud Console 中，确保以下 URI 都已添加：

```
http://localhost:3000/api/auth/callback/google
https://yesnoex.com/api/auth/callback/google
https://www.yesnoex.com/api/auth/callback/google
```

**注意：**
- ✅ URI 必须**完全匹配**（包括协议 `http://` 或 `https://`）
- ✅ URI 路径必须是 `/api/auth/callback/google`（NextAuth 默认回调路径）
- ✅ 不要包含尾部斜杠 `/`

### 3. 常见问题排查

#### 问题 1: Client ID 不完整

**症状：** Client ID 被截断或格式不正确

**解决方案：**
1. 在 Google Cloud Console 中复制完整的 Client ID
2. 确保包含 `.apps.googleusercontent.com` 后缀
3. 在 Vercel 中重新设置环境变量

#### 问题 2: Client ID 和 Secret 不匹配

**症状：** Client ID 和 Secret 来自不同的 OAuth 客户端

**解决方案：**
1. 在 Google Cloud Console 中，确保 Client ID 和 Secret 来自同一个 OAuth 客户端
2. 如果需要，创建一个新的 OAuth 客户端并重新配置

#### 问题 3: 环境变量格式错误

**症状：** 环境变量值包含空格或引号

**错误示例：**
```
GOOGLE_CLIENT_ID="755756245858-xxx.apps.googleusercontent.com"  ❌ 有引号
GOOGLE_CLIENT_ID = 755756245858-xxx.apps.googleusercontent.com  ❌ 等号前后有空格
GOOGLE_CLIENT_ID= 755756245858-xxx.apps.googleusercontent.com   ❌ 值前面有空格
```

**正确格式：**
```
GOOGLE_CLIENT_ID=755756245858-xxx.apps.googleusercontent.com   ✅ 正确
```

### 4. 重新部署应用

修改环境变量后：
1. 在 Vercel 中保存环境变量
2. 触发新的部署（或等待自动部署）
3. 清除浏览器缓存和 Cookies
4. 重新测试 Google 登录

### 5. 验证步骤

1. **检查 Vercel 日志**
   - 查看部署日志中的 `GOOGLE_CLIENT_ID_CHECK` 和 `GOOGLE_CLIENT_SECRET_CHECK`
   - 确认环境变量已正确加载

2. **测试登录**
   - 访问登录页面
   - 点击 Google 登录按钮
   - 确认不再出现 `invalid_client` 错误

## 如果问题仍然存在

如果按照上述步骤仍无法解决问题，请检查：

1. **OAuth 同意屏幕配置**
   - 在 Google Cloud Console 中，确保 OAuth 同意屏幕已正确配置
   - 确保应用状态为"已发布"或已添加测试用户

2. **API 启用状态**
   - 确保已启用必要的 Google API（如 Google+ API 或 People API）

3. **联系支持**
   - 如果问题持续，请联系 Google Cloud Console 支持或检查 NextAuth.js 文档

