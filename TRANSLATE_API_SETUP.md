# 翻译 API 配置说明

## Google Cloud Translation API 配置

### 1. 获取 API Key

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 "Cloud Translation API"
4. 转到 "凭据" -> "创建凭据" -> "API 密钥"
5. 复制生成的 API 密钥

### 2. 配置环境变量

在项目根目录的 `.env` 文件中添加：

```env
# 翻译 API 配置
TRANSLATE_API_KEY=your_google_translate_api_key_here
```

### 3. 使用方式

翻译服务已经集成到数据采集脚本中，会自动在采集 Polymarket 数据时翻译标题和描述。

### 4. 定价说明

Google Cloud Translation API 提供免费额度：
- 前 500,000 字符/月免费
- 超出后按 $20/百万字符收费

### 5. 备用方案

如果没有配置 API Key，系统会跳过翻译，在审核中心显示英文标题并标注"待翻译"标签。

---

## 其他翻译 API 选项

如果需要使用其他翻译服务，可以修改 `lib/scrapers/translateService.ts` 中的 `translateWithGoogleAPI` 函数：

### DeepL API

```typescript
async function translateWithDeepLAPI(text: string, targetLang: string): Promise<string> {
  const apiKey = process.env.DEEPL_API_KEY;
  const response = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [text],
      target_lang: targetLang.toUpperCase(),
    }),
  });
  const data = await response.json();
  return data.translations[0].text;
}
```

### Azure Translator

```typescript
async function translateWithAzureAPI(text: string, targetLang: string): Promise<string> {
  const apiKey = process.env.AZURE_TRANSLATOR_KEY;
  const region = process.env.AZURE_TRANSLATOR_REGION;
  const response = await fetch(`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${targetLang}`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Ocp-Apim-Subscription-Region': region,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{ text }]),
  });
  const data = await response.json();
  return data[0].translations[0].text;
}
```
