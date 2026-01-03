/**
 * AI 翻译服务
 * 使用 GPT-4o-mini 或 Claude 进行高质量翻译
 * 特别优化预测市场术语的翻译质量
 * 
 * 配置说明：
 * 1. 优先使用 OpenAI (GPT-4o-mini)：设置 OPENAI_API_KEY
 * 2. 或使用 Anthropic (Claude)：设置 ANTHROPIC_API_KEY
 * 
 * 如果没有配置 API Key，将返回空字符串（表示待翻译）
 */

/**
 * 语言代码映射
 */
const LANGUAGE_CODE_MAP: Record<string, string> = {
  'zh': '中文',
  'zh-CN': '中文',
  'zh-TW': '繁体中文',
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'ja': 'Japanese',
  'ko': 'Korean',
};

/**
 * 使用 OpenAI GPT-4o-mini 翻译文本
 * @param text 要翻译的文本
 * @param targetLang 目标语言代码（默认：'zh' 中文）
 * @returns 翻译后的文本
 */
async function translateWithOpenAI(
  text: string,
  targetLang: string = 'zh'
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  
  if (!apiKey || apiKey.includes('请替换') || apiKey.includes('可选')) {
    throw new Error('OPENAI_API_KEY 未配置或无效');
  }

  const languageName = LANGUAGE_CODE_MAP[targetLang] || '中文';

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `你是一位专业的金融和预测市场翻译专家。请将以下英文预测市场标题或描述翻译成${languageName}。

翻译要求：
1. 保持预测市场的专业术语准确性（如 "Will...", "Yes/No", "reach", "between" 等）
2. 数字、日期、货币符号保持原样
3. 加密货币名称使用中文常用名称（如 Bitcoin -> 比特币，Ethereum -> 以太坊）
4. 语言自然流畅，符合中文表达习惯
5. 如果是问句，保持问句格式

只返回翻译结果，不要添加任何解释或注释。`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.3, // 降低温度以获得更一致的翻译
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      return data.choices[0].message.content.trim();
    }
    
    throw new Error('翻译响应格式不正确');
  } catch (error) {
    console.error(`❌ [Translate] OpenAI API 翻译失败:`, error);
    throw error;
  }
}

/**
 * 使用 Anthropic Claude 翻译文本
 * @param text 要翻译的文本
 * @param targetLang 目标语言代码（默认：'zh' 中文）
 * @returns 翻译后的文本
 */
async function translateWithClaude(
  text: string,
  targetLang: string = 'zh'
): Promise<string> {
  // 🔥 使用与 translateText 相同的处理逻辑
  let apiKeyRaw = process.env.ANTHROPIC_API_KEY;
  
  if (apiKeyRaw) {
    apiKeyRaw = apiKeyRaw.trim();
    // 移除首尾的引号（单引号或双引号）
    if ((apiKeyRaw.startsWith('"') && apiKeyRaw.endsWith('"')) ||
        (apiKeyRaw.startsWith("'") && apiKeyRaw.endsWith("'"))) {
      apiKeyRaw = apiKeyRaw.slice(1, -1);
    }
    // 移除所有空白字符
    apiKeyRaw = apiKeyRaw.replace(/\s+/g, '');
  }
  
  const apiKey = apiKeyRaw || null;
  
  if (!apiKey || apiKey.includes('请替换') || apiKey.includes('可选') || apiKey.length < 20) {
    throw new Error('ANTHROPIC_API_KEY 未配置或无效');
  }

  // 🔥 放宽验证：只检查明显的非法字符（中文字符、控制字符等）
  const hasInvalidChars = /[\u4e00-\u9fff\u0000-\u001f\u007f-\u009f]/.test(apiKey);
  if (hasInvalidChars) {
    console.error(`❌ [Translate] ANTHROPIC_API_KEY 格式无效：包含非法字符（中文字符或控制字符）`);
    throw new Error('ANTHROPIC_API_KEY 格式无效：包含非法字符');
  }

  const languageName = LANGUAGE_CODE_MAP[targetLang] || '中文';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `请将以下英文预测市场标题或描述翻译成${languageName}。

翻译要求：
1. 保持预测市场的专业术语准确性（如 "Will...", "Yes/No", "reach", "between" 等）
2. 数字、日期、货币符号保持原样
3. 加密货币名称使用中文常用名称（如 Bitcoin -> 比特币，Ethereum -> 以太坊）
4. 语言自然流畅，符合中文表达习惯
5. 如果是问句，保持问句格式

只返回翻译结果，不要添加任何解释或注释。

原文：
${text}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (data.content && data.content.length > 0 && data.content[0].text) {
      return data.content[0].text.trim();
    }
    
    throw new Error('翻译响应格式不正确');
  } catch (error) {
    console.error(`❌ [Translate] Anthropic API 翻译失败:`, error);
    throw error;
  }
}

/**
 * 翻译文本（优先使用 OpenAI，如果未配置则使用 Anthropic）
 * @param text 要翻译的英文文本
 * @param targetLang 目标语言（默认：'zh' 中文）
 * @returns 翻译后的文本，如果翻译失败或未配置 API Key，返回空字符串
 */
export async function translateText(
  text: string,
  targetLang: string = 'zh'
): Promise<string> {
  // 空文本直接返回
  if (!text || !text.trim()) {
    return '';
  }

  // 🔥 改进环境变量处理：移除所有空白字符（包括换行符、制表符等）
  const openaiKey = process.env.OPENAI_API_KEY?.trim().replace(/\s+/g, '') || null;
  let anthropicKeyRaw = process.env.ANTHROPIC_API_KEY;
  
  // 🔥 处理可能的引号包裹（.env 文件中可能有引号）
  if (anthropicKeyRaw) {
    anthropicKeyRaw = anthropicKeyRaw.trim();
    // 移除首尾的引号（单引号或双引号）
    if ((anthropicKeyRaw.startsWith('"') && anthropicKeyRaw.endsWith('"')) ||
        (anthropicKeyRaw.startsWith("'") && anthropicKeyRaw.endsWith("'"))) {
      anthropicKeyRaw = anthropicKeyRaw.slice(1, -1);
    }
    // 移除所有空白字符
    anthropicKeyRaw = anthropicKeyRaw.replace(/\s+/g, '');
  }
  
  const anthropicKey = anthropicKeyRaw || null;

  // 🔥 验证 ANTHROPIC_API_KEY 格式（放宽验证，只检查基本格式）
  let anthropicKeyValid = false;
  let anthropicKeyError = '';
  
  if (anthropicKey) {
    if (anthropicKey.includes('可选') || anthropicKey.includes('请替换')) {
      anthropicKeyError = '包含占位符';
    } else if (anthropicKey.length === 0) {
      anthropicKeyError = '为空字符串';
    } else if (anthropicKey.length < 10) {
      // 🔥 放宽长度要求：至少 10 个字符（Anthropic API Key 通常更长，但先接受）
      anthropicKeyError = `长度过短 (${anthropicKey.length} 字符，至少需要 10 字符)`;
    } else {
      // 🔥 放宽验证：只检查是否包含明显的非法字符（中文字符、控制字符等）
      // Anthropic API Key 通常以 sk-ant- 开头，但我们也接受其他格式
      // 只拒绝明显的错误：中文字符、控制字符（但允许所有可打印的 ASCII 和扩展 ASCII 字符）
      const hasInvalidChars = /[\u4e00-\u9fff\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(anthropicKey);
      if (hasInvalidChars) {
        anthropicKeyError = '包含非法字符（中文字符或控制字符）';
      } else {
        anthropicKeyValid = true;
      }
    }
  } else {
    anthropicKeyError = '未配置';
  }

  // 🔥 调试：检查环境变量（每次失败时都输出详细日志，帮助诊断问题）
  const shouldLogDetails = !(translateText as any)._loggedOnce || !anthropicKeyValid;
  if (shouldLogDetails) {
    console.log('🔍 [Translate Service] 环境变量检查:');
    console.log('  OPENAI_API_KEY:', openaiKey ? `${openaiKey.substring(0, 10)}... (长度: ${openaiKey.length})` : '未配置');
    if (anthropicKeyValid && anthropicKey) {
      console.log('  ANTHROPIC_API_KEY: ✅ 已配置 (长度: ' + anthropicKey.length + ', 前缀: ' + anthropicKey.substring(0, 7) + '...)');
      (translateText as any)._loggedOnce = true;
    } else {
      console.log('  ANTHROPIC_API_KEY: ❌ ' + anthropicKeyError);
      if (anthropicKey && anthropicKey.length > 0) {
        console.log('    API Key 前20个字符:', JSON.stringify(anthropicKey.substring(0, 20)) + '...');
        console.log('    API Key 长度:', anthropicKey.length);
        console.log('    API Key 字符编码检查 (前20个):', Array.from(anthropicKey.substring(0, 20)).map(c => {
          const code = c.charCodeAt(0);
          return `${c}(${code})`;
        }).join(', '));
        // 🔥 检查是否以 sk-ant- 开头（Anthropic API Key 的标准格式）
        if (anthropicKey.startsWith('sk-ant-')) {
          console.log('    ✅ API Key 格式正确（以 sk-ant- 开头）');
        } else {
          console.log('    ⚠️ API Key 不以 sk-ant- 开头（可能是其他格式）');
        }
      } else if (process.env.ANTHROPIC_API_KEY) {
        const rawValue = process.env.ANTHROPIC_API_KEY;
        console.log('    原始环境变量存在，但处理后为空');
        console.log('    原始值长度:', rawValue.length);
        console.log('    原始值前20个字符:', JSON.stringify(rawValue.substring(0, 20)));
        console.log('    原始值字符编码 (前20个):', Array.from(rawValue.substring(0, 20)).map(c => {
          const code = c.charCodeAt(0);
          return `${c}(${code})`;
        }).join(', '));
      } else {
        console.log('    ⚠️ process.env.ANTHROPIC_API_KEY 不存在');
      }
    }
  }

  // 如果没有配置任何有效的 API Key，返回空字符串（表示待翻译）
  if (!openaiKey && !anthropicKeyValid) {
    console.warn('⚠️ [Translate] 未配置有效的 OPENAI_API_KEY 或 ANTHROPIC_API_KEY，跳过翻译');
    return '';
  }
  
  // 🔥 检查 API Key 是否是占位符
  if (openaiKey && (openaiKey.includes('请替换') || openaiKey.includes('可选'))) {
    console.warn('⚠️ [Translate] OPENAI_API_KEY 是占位符，跳过翻译');
    return '';
  }

  try {
    // 优先使用 OpenAI (GPT-4o-mini)
    if (openaiKey) {
      try {
        const translatedText = await translateWithOpenAI(text, targetLang);
        return translatedText;
      } catch (error) {
        // 🔥 检查是否是配额错误（429 insufficient_quota）
        const isQuotaError = error instanceof Error && 
          (error.message.includes('429') || 
           error.message.includes('insufficient_quota') ||
           error.message.includes('quota'));
        
        if (isQuotaError) {
          console.warn('⚠️ [Translate] OpenAI 配额已用完，尝试使用 Claude...');
        } else {
          console.warn('⚠️ [Translate] OpenAI 翻译失败，尝试使用 Claude:', error);
        }
        
        // 如果 OpenAI 失败，尝试使用 Claude（需要验证格式）
        if (anthropicKeyValid) {
          try {
            const translatedText = await translateWithClaude(text, targetLang);
            return translatedText;
          } catch (claudeError) {
            console.error('❌ [Translate] Claude 翻译也失败:', claudeError);
            // 如果 Claude 也失败，返回空字符串
            return '';
          }
        }
        // 如果没有配置 Claude 或配额错误，返回空字符串而不是抛出错误
        if (isQuotaError) {
          console.warn('⚠️ [Translate] OpenAI 配额已用完且未配置 Claude，跳过翻译');
          return '';
        }
        throw error;
      }
    }
    
    // 如果没有 OpenAI Key，使用 Claude（需要验证格式）
    if (anthropicKeyValid) {
      const translatedText = await translateWithClaude(text, targetLang);
      return translatedText;
    }
    
    return '';
  } catch (error) {
    console.error(`❌ [Translate] 翻译失败:`, error);
    // 翻译失败时返回空字符串，不影响主流程
    return '';
  }
}

/**
 * 批量翻译文本
 * @param texts 要翻译的文本数组
 * @param targetLang 目标语言（默认：'zh' 中文）
 * @returns 翻译后的文本数组
 */
export async function translateBatch(
  texts: string[],
  targetLang: string = 'zh'
): Promise<string[]> {
  const results = await Promise.all(
    texts.map(text => translateText(text, targetLang))
  );
  return results;
}
