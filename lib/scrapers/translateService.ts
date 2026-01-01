/**
 * 翻译服务
 * 支持 Google Cloud Translation API
 * 
 * 配置说明：
 * 1. 在 .env 文件中添加 TRANSLATE_API_KEY（Google Cloud Translation API Key）
 * 2. 或者设置 GOOGLE_APPLICATION_CREDENTIALS（服务账号 JSON 文件路径）
 * 
 * 如果没有配置 API Key，将返回空字符串（表示待翻译）
 */

/**
 * 语言代码映射
 */
const LANGUAGE_CODE_MAP: Record<string, string> = {
  'zh': 'zh-CN', // 简体中文
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW', // 繁体中文
  'en': 'en',
  'es': 'es', // 西班牙语
  'fr': 'fr', // 法语
  'de': 'de', // 德语
  'ja': 'ja', // 日语
  'ko': 'ko', // 韩语
};

/**
 * 使用 Google Cloud Translation API 翻译文本
 * @param text 要翻译的文本
 * @param targetLang 目标语言代码（默认：'zh-CN'）
 * @returns 翻译后的文本
 */
async function translateWithGoogleAPI(
  text: string,
  targetLang: string = 'zh-CN'
): Promise<string> {
  const apiKey = process.env.TRANSLATE_API_KEY;
  
  if (!apiKey) {
    throw new Error('TRANSLATE_API_KEY 未配置');
  }

  // 映射语言代码
  const languageCode = LANGUAGE_CODE_MAP[targetLang] || targetLang;

  try {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        target: languageCode,
        source: 'en', // 假设源语言是英文
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Translate API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (data.data && data.data.translations && data.data.translations.length > 0) {
      return data.data.translations[0].translatedText;
    }
    
    throw new Error('翻译响应格式不正确');
  } catch (error) {
    console.error(`❌ [Translate] Google API 翻译失败:`, error);
    throw error;
  }
}

/**
 * 翻译文本
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

  const apiKey = process.env.TRANSLATE_API_KEY;

  // 如果没有配置 API Key，返回空字符串（表示待翻译）
  if (!apiKey) {

    return '';
  }

  try {

    const translatedText = await translateWithGoogleAPI(text, targetLang);

    return translatedText;
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
