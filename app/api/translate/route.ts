import { NextRequest, NextResponse } from 'next/server';
import { translateText } from '@/lib/scrapers/translateService';

/**
 * 翻译 API
 * POST /api/translate
 * 
 * 请求体：
 * {
 *   "text": "要翻译的文本",
 *   "targetLang": "zh" // 可选，默认 "zh"
 * }
 * 
 * 返回：
 * {
 *   "success": true,
 *   "translatedText": "翻译后的文本"
 * }
 */
export const dynamic = 'force-dynamic'; // 🔥 确保 API 路由是动态的

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, targetLang = 'zh' } = body;

    console.log('🔍 [Translate API] 收到翻译请求:', { text: text?.substring(0, 50), targetLang });

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'text is required and must be a string',
        },
        { status: 400 }
      );
    }

    // 🔥 调试：检查环境变量
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
    console.log('🔍 [Translate API] 环境变量检查:');
    console.log('  OPENAI_API_KEY:', openaiKey ? `${openaiKey.substring(0, 10)}... (长度: ${openaiKey?.length})` : '未配置');
    console.log('  ANTHROPIC_API_KEY:', anthropicKey && !anthropicKey.includes('可选') ? '已配置' : '未配置');

    // 调用翻译服务
    let translatedText: string;
    try {
      translatedText = await translateText(text, targetLang);
      console.log('✅ [Translate API] 翻译服务返回:', translatedText?.substring(0, 50));
    } catch (error) {
      console.error('❌ [Translate API] 翻译服务抛出异常:', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Translation failed',
        },
        { status: 500 }
      );
    }

    if (!translatedText || translatedText.trim() === '') {
      console.error('❌ [Translate API] 翻译返回空字符串');
      console.error('  环境变量检查:');
      console.error('    OPENAI_API_KEY:', openaiKey ? `${openaiKey.substring(0, 10)}... (长度: ${openaiKey?.length})` : '未配置');
      console.error('    ANTHROPIC_API_KEY:', anthropicKey && !anthropicKey.includes('可选') ? '已配置' : '未配置');
      
      return NextResponse.json(
        {
          success: false,
          error: 'Translation failed or API key not configured. Check server logs for details.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      translatedText,
    });
  } catch (error) {
    console.error('❌ [Translate API] 翻译失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Translation failed',
      },
      { status: 500 }
    );
  }
}
