# AI 翻译服务配置指南

## 为什么使用 AI 翻译？

对于预测市场这类语义复杂的数据，使用 AI 翻译（如 GPT-4o-mini 或 Claude）是目前最专业、质量最高的方案。

传统的谷歌翻译在处理"Will Ethereum reach $3,300..."、"Yes/No"这类博弈术语时，经常会出现生硬的错位，而 AI 可以根据上下文给出更自然的中文表达。

## 支持的 AI 服务

### 1. OpenAI (GPT-4o-mini) - 推荐

**优势：**
- 速度快，成本低
- 对预测市场术语理解准确
- 翻译质量高

**配置步骤：**

1. 访问 [OpenAI Platform](https://platform.openai.com/)
2. 注册账号并创建 API Key
3. 在 `.env.local` 文件中添加：
   ```env
   OPENAI_API_KEY="sk-你的API密钥"
   ```

**定价：**
- GPT-4o-mini: $0.15 / 1M input tokens, $0.60 / 1M output tokens
- 对于翻译任务，成本非常低（每个市场标题约 0.001-0.002 美元）

### 2. Anthropic (Claude) - 备选

**优势：**
- 翻译质量极高
- 对上下文理解更深入

**配置步骤：**

1. 访问 [Anthropic Console](https://console.anthropic.com/)
2. 注册账号并创建 API Key
3. 在 `.env.local` 文件中添加：
   ```env
   ANTHROPIC_API_KEY="sk-ant-你的API密钥"
   ```

**定价：**
- Claude 3.5 Sonnet: $3 / 1M input tokens, $15 / 1M output tokens
- 成本较高，但质量最好

## 配置环境变量

### 方法 1: 使用 .env.local 文件（推荐）

在项目根目录的 `.env.local` 文件中添加：

```env
# 优先使用 OpenAI (推荐)
OPENAI_API_KEY="sk-你的OpenAI API密钥"

# 可选：如果未配置 OPENAI_API_KEY，将使用 Claude
ANTHROPIC_API_KEY="sk-ant-你的Anthropic API密钥"
```

### 方法 2: 使用系统环境变量

```bash
# macOS/Linux
export OPENAI_API_KEY="sk-你的API密钥"
export ANTHROPIC_API_KEY="sk-ant-你的API密钥"  # 可选

# Windows (PowerShell)
$env:OPENAI_API_KEY="sk-你的API密钥"
$env:ANTHROPIC_API_KEY="sk-ant-你的API密钥"  # 可选
```

## 翻译优先级

系统会按以下优先级选择翻译服务：

1. **优先使用 OpenAI**：如果配置了 `OPENAI_API_KEY`，优先使用 GPT-4o-mini
2. **降级到 Claude**：如果 OpenAI 失败或未配置，使用 Claude
3. **跳过翻译**：如果两者都未配置，跳过翻译，使用原始英文

## 验证配置

配置完成后，重启服务器：

```bash
# 停止当前服务器
lsof -ti:3000 | xargs kill -9

# 重新启动
npm start
```

运行 Polymarket 采集器时，如果配置正确，会在日志中看到翻译过程。如果未配置，会跳过翻译步骤（不影响数据保存）。

## 翻译优化

AI 翻译服务已针对预测市场进行了优化：

1. **专业术语处理**：
   - "Will..." → "是否..."
   - "reach" → "达到"
   - "between" → "在...之间"
   - "Yes/No" → 保持原样或根据上下文翻译

2. **加密货币名称**：
   - Bitcoin → 比特币
   - Ethereum → 以太坊
   - 其他币种使用中文常用名称

3. **数字和日期**：
   - 保持原样，不进行本地化转换

4. **自然语言**：
   - 根据上下文调整语序
   - 符合中文表达习惯

## 注意事项

1. **安全性**：
   - `.env.local` 文件已添加到 `.gitignore`，不会被提交到 Git
   - 不要将 API Key 提交到代码仓库
   - 生产环境建议使用环境变量或密钥管理服务

2. **费用控制**：
   - OpenAI GPT-4o-mini 成本很低，适合大量翻译
   - Claude 成本较高，但质量最好
   - 建议监控 API 使用情况，设置使用限额

3. **性能**：
   - 翻译是异步进行的，不会阻塞数据保存
   - 如果翻译 API 失败，系统会跳过翻译，使用原始英文
   - 翻译结果会缓存在数据库中，不会重复翻译

4. **速率限制**：
   - OpenAI: 根据你的账户等级有不同的速率限制
   - Anthropic: 根据你的账户等级有不同的速率限制
   - 如果遇到速率限制，系统会自动重试或跳过

## 故障排除

### 问题：翻译功能不工作

1. **检查 API Key 是否正确**：
   ```bash
   # 在 Node.js 中测试
   node -e "console.log(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY)"
   ```

2. **检查 API Key 权限**：
   - OpenAI: 确认 API Key 有权限访问 Chat Completions API
   - Anthropic: 确认 API Key 有权限访问 Messages API

3. **检查账户余额**：
   - OpenAI: 访问 https://platform.openai.com/account/billing
   - Anthropic: 访问 https://console.anthropic.com/settings/billing

4. **查看日志**：
   - 运行采集器时查看控制台输出
   - 如果看到 "翻译失败" 错误，检查错误信息

### 问题：翻译速度慢

- AI 翻译需要调用外部 API，速度比传统翻译慢
- 可以考虑：
  1. 使用 GPT-4o-mini（速度最快）
  2. 批量处理翻译（已在代码中实现）
  3. 在后台异步翻译（不影响采集速度）

### 问题：翻译质量不满意

- 可以调整 `translateService.ts` 中的 system prompt
- 针对特定类型的市场，可以添加更详细的翻译规则
- 如果使用 Claude，质量会更好但成本更高
