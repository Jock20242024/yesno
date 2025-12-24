/**
 * 🔥 诊断脚本：分析活跃市场为何无法绑定
 * 
 * 用途：生成详细的诊断报告，分析为什么 OPEN 状态的市场无法绑定 externalId
 * 执行：npm run diagnose-file
 * 
 * 输出：diagnosis_report.md
 */

import { PrismaClient } from '@prisma/client';
import { writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { config } from 'dotenv';

// 加载环境变量
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

/**
 * 资产别名映射字典（与 engine.ts 保持一致）
 */
const ASSET_ALIASES: Record<string, string[]> = {
  'BTC': ['BITCOIN', 'BTC', 'XBT', 'BIT COIN'],
  'ETH': ['ETHEREUM', 'ETH', 'ETHER'],
  'SOL': ['SOLANA', 'SOL'],
  'BNB': ['BINANCE', 'BINANCE COIN', 'BNB'],
  'XRP': ['RIPPLE', 'XRP'],
  'ADA': ['CARDANO', 'ADA'],
  'DOGE': ['DOGECOIN', 'DOGE', 'DOG E'],
  'MATIC': ['POLYGON', 'MATIC'],
  'DOT': ['POLKADOT', 'DOT'],
  'AVAX': ['AVALANCHE', 'AVAX'],
  'LINK': ['CHAINLINK', 'LINK'],
  'UNI': ['UNISWAP', 'UNI'],
  'ATOM': ['COSMOS', 'ATOM'],
  'ETC': ['ETHEREUM CLASSIC', 'ETC', 'ETH CLASSIC'],
  'LTC': ['LITECOIN', 'LTC'],
  'BCH': ['BITCOIN CASH', 'BCH', 'BTC CASH'],
  'XLM': ['STELLAR', 'XLM'],
  'ALGO': ['ALGORAND', 'ALGO'],
  'VET': ['VECHAIN', 'VET'],
  'FIL': ['FILECOIN', 'FIL'],
  'TRX': ['TRON', 'TRX'],
  'EOS': ['EOS'],
  'AAVE': ['AAVE'],
  'MKR': ['MAKER', 'MKR'],
  'COMP': ['COMPOUND', 'COMP'],
  'YFI': ['YEARN FINANCE', 'YFI'],
  'SUSHI': ['SUSHISWAP', 'SUSHI'],
  'SNX': ['SYNTHETIX', 'SNX'],
  'NEAR': ['NEAR PROTOCOL', 'NEAR'],
  'APT': ['APTOS', 'APT'],
  'OP': ['OPTIMISM', 'OP'],
  'ARB': ['ARBITRUM', 'ARB'],
  'IMX': ['IMMUTABLE X', 'IMX'],
  'GRT': ['THE GRAPH', 'GRT'],
  'RUNE': ['THORCHAIN', 'RUNE'],
  'INJ': ['INJECTIVE', 'INJ'],
  'TIA': ['CELESTIA', 'TIA'],
  'SEI': ['SEI', 'SEI NETWORK'],
  'SUI': ['SUI'],
  'PYTH': ['PYTH NETWORK', 'PYTH'],
  'JTO': ['JITO', 'JTO'],
};

/**
 * 提取 Polymarket 市场的结束时间
 */
function extractEndTime(polyMarket: any): Date | null {
  if (polyMarket.endDate) {
    return new Date(polyMarket.endDate);
  }
  if (polyMarket.endDateISO) {
    return new Date(polyMarket.endDateISO);
  }
  if (polyMarket.events && Array.isArray(polyMarket.events) && polyMarket.events.length > 0) {
    const firstEvent = polyMarket.events[0];
    if (firstEvent.endDate) {
      return new Date(firstEvent.endDate);
    }
    if (firstEvent.endDateISO) {
      return new Date(firstEvent.endDateISO);
    }
  }
  return null;
}

/**
 * 资产名称匹配检查
 */
function isSymbolMatch(localSymbol: string, polyMarket: any): boolean {
  const s = localSymbol.toUpperCase().trim();
  
  const question = (polyMarket.question || '').toUpperCase();
  const slug = (polyMarket.slug || '').toUpperCase();
  const asset = (polyMarket.asset || '').toUpperCase();
  const description = (polyMarket.description || '').toUpperCase();
  const text = `${question} ${slug} ${asset} ${description}`;
  
  const aliases = ASSET_ALIASES[s] || [s];
  
  for (const alias of aliases) {
    if (text.includes(alias)) {
      return true;
    }
  }
  
  return false;
}

/**
 * 静默抓取 Polymarket 市场数据（不打印日志）
 */
async function fetchMarketsSilently(): Promise<any[]> {
  const allMarkets: any[] = [];
  const limit = 1000;
  const MAX_SAFE_LIMIT = 6000;
  let offset = 0;
  let page = 1;
  let hasMoreData = true;

  const fetchWithRetry = async (url: string, retries = 3): Promise<Response> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        
        if (response.ok) {
          return response;
        }
        
        if (attempt === retries) {
          return response;
        }
        
        await new Promise(resolve => setTimeout(resolve, attempt * 500));
      } catch (error: any) {
        if (attempt === retries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, attempt * 500));
      }
    }
    throw new Error('所有重试都失败了');
  };

  // 抓取开放市场
  while (hasMoreData && allMarkets.length < MAX_SAFE_LIMIT) {
    const apiUrl = `https://gamma-api.polymarket.com/markets?closed=false&limit=${limit}&offset=${offset}&order=volume&ascending=false`;
    
    try {
      const response = await fetchWithRetry(apiUrl);

      if (!response.ok) {
        hasMoreData = false;
        break;
      }

      const pageMarkets = await response.json();
      
      if (!pageMarkets || !Array.isArray(pageMarkets)) {
        hasMoreData = false;
        break;
      }
      
      if (pageMarkets.length === 0) {
        hasMoreData = false;
        break;
      }
      
      allMarkets.push(...pageMarkets);
      
      offset += pageMarkets.length;
      page++;
      
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      hasMoreData = false;
      break;
    }
  }

  return allMarkets;
}

/**
 * 分析匹配失败的原因
 */
function analyzeMatchFailure(
  localMarket: any,
  polyMarkets: any[],
  reportContent: string
): string {
  const assetSymbol = localMarket.marketTemplate?.symbol?.split('/')[0].toUpperCase() || 'UNKNOWN';
  const localEndTime = new Date(localMarket.closingDate).getTime();
  const timeWindowMs = 2 * 60 * 60 * 1000; // ±2 小时

  reportContent += `## 🔍 本地市场信息\n\n`;
  reportContent += `- **市场ID**: ${localMarket.id}\n`;
  reportContent += `- **标题**: ${localMarket.title || 'N/A'}\n`;
  reportContent += `- **资产符号**: ${assetSymbol}\n`;
  reportContent += `- **周期**: ${localMarket.period || 'N/A'} 分钟\n`;
  reportContent += `- **结束时间**: ${new Date(localMarket.closingDate).toISOString()}\n`;
  reportContent += `- **状态**: ${localMarket.status}\n`;
  reportContent += `- **externalId**: ${localMarket.externalId || 'NULL'}\n`;
  reportContent += `- **模板ID**: ${localMarket.templateId || 'N/A'}\n\n`;

  // 找出所有时间误差在 ±2 小时内的嫌疑对象
  const candidates: Array<{
    market: any;
    timeDiff: number;
    symbolMatch: boolean;
    reasons: string[];
  }> = [];

  for (const polyMarket of polyMarkets) {
    const polyEndTime = extractEndTime(polyMarket);
    if (!polyEndTime) {
      continue;
    }

    const timeDiff = Math.abs(polyEndTime.getTime() - localEndTime);
    
    // 只分析时间误差在 ±2 小时内的市场
    if (timeDiff <= timeWindowMs) {
      const symbolMatch = isSymbolMatch(assetSymbol, polyMarket);
      const reasons: string[] = [];

      // 检查各个匹配条件
      if (!symbolMatch) {
        const question = (polyMarket.question || '').toUpperCase();
        const slug = (polyMarket.slug || '').toUpperCase();
        reasons.push(`❌ 资产名称不匹配（本地: ${assetSymbol}, Polymarket: "${question}" / "${slug}"）`);
      } else {
        reasons.push(`✅ 资产名称匹配`);
      }

      const timeDiffMinutes = timeDiff / (60 * 1000);
      if (timeDiffMinutes > 15) {
        reasons.push(`⚠️ 时间差异过大: ${timeDiffMinutes.toFixed(2)} 分钟（超过 ±15 分钟窗口）`);
      } else {
        reasons.push(`✅ 时间差异可接受: ${timeDiffMinutes.toFixed(2)} 分钟`);
      }

      if (localMarket.status === 'OPEN' && polyMarket.closed === true) {
        reasons.push(`❌ 状态不一致（本地: OPEN, Polymarket: closed=true）`);
      } else {
        reasons.push(`✅ 状态一致或可接受`);
      }

      candidates.push({
        market: polyMarket,
        timeDiff,
        symbolMatch,
        reasons,
      });
    }
  }

  // 按时间差异排序，取前 10 个最接近的
  candidates.sort((a, b) => a.timeDiff - b.timeDiff);
  const topCandidates = candidates.slice(0, 10);

  reportContent += `## 📊 分析结果\n\n`;
  reportContent += `- **Polymarket 总市场数**: ${polyMarkets.length}\n`;
  reportContent += `- **时间窗口内候选数** (±2小时): ${candidates.length}\n`;
  reportContent += `- **分析前10个最接近的候选**\n\n`;

  if (topCandidates.length === 0) {
    reportContent += `❌ **未找到任何时间窗口内的候选市场**\n\n`;
    reportContent += `可能原因：\n`;
    reportContent += `1. Polymarket 上可能没有对应的市场\n`;
    reportContent += `2. 时间差异过大（超过 ±2 小时）\n`;
    reportContent += `3. 资产符号不匹配\n\n`;
  } else {
    topCandidates.forEach((candidate, index) => {
      const timeDiffMinutes = candidate.timeDiff / (60 * 1000);
      const polyEndTime = extractEndTime(candidate.market);
      
      reportContent += `### 候选 #${index + 1}\n\n`;
      reportContent += `- **Polymarket ID**: ${candidate.market.id}\n`;
      reportContent += `- **标题**: ${candidate.market.question || candidate.market.slug || 'N/A'}\n`;
      reportContent += `- **结束时间**: ${polyEndTime ? polyEndTime.toISOString() : 'N/A'}\n`;
      reportContent += `- **时间差异**: ${timeDiffMinutes.toFixed(2)} 分钟\n`;
      reportContent += `- **closed 状态**: ${candidate.market.closed ? 'true' : 'false'}\n`;
      reportContent += `- **资产符号匹配**: ${candidate.symbolMatch ? '✅ 是' : '❌ 否'}\n\n`;
      
      reportContent += `**拒绝理由分析**:\n\n`;
      candidate.reasons.forEach(reason => {
        reportContent += `- ${reason}\n`;
      });
      reportContent += `\n`;
    });
  }

  return reportContent;
}

async function diagnose() {
  let reportContent = '';
  
  try {
    reportContent += `# 🔍 市场绑定诊断报告\n\n`;
    reportContent += `**生成时间**: ${new Date().toISOString()}\n\n`;
    reportContent += `---\n\n`;

    // 1. 寻找病例：优先 15m 或 1h 的 OPEN 市场，且 externalId 为空
    const targetMarket = await prisma.market.findFirst({
      where: {
        status: 'OPEN',
        externalId: null,
        isFactory: true,
        reviewStatus: 'PUBLISHED',
      },
      include: {
        marketTemplate: {
          select: {
            symbol: true,
            period: true,
          },
        },
      },
      orderBy: [
        { period: 'asc' }, // 优先 15m
      ],
    });

    if (!targetMarket) {
      reportContent += `❌ **未找到符合条件的市场**\n\n`;
      reportContent += `查询条件：\n`;
      reportContent += `- status = 'OPEN'\n`;
      reportContent += `- externalId = NULL\n`;
      reportContent += `- isFactory = true\n`;
      reportContent += `- reviewStatus = 'PUBLISHED'\n\n`;
      reportContent += `可能原因：所有 OPEN 市场都已绑定 externalId，或没有符合条件的工厂市场。\n`;
      
      await writeFile(
        join(process.cwd(), 'diagnosis_report.md'),
        reportContent,
        'utf-8'
      );
      
      console.log('✅ 诊断完成，请打开 diagnosis_report.md 查看详情。');
      return;
    }

    reportContent += `## 📋 目标市场\n\n`;
    reportContent += `找到目标市场用于分析：\n\n`;

    // 2. 获取 Polymarket 数据
    reportContent += `## 🔄 数据获取\n\n`;
    reportContent += `正在抓取 Polymarket 最新市场数据（最多 6000 个）...\n\n`;
    
    const polyMarkets = await fetchMarketsSilently();
    
    reportContent += `✅ 已获取 ${polyMarkets.length} 个 Polymarket 市场\n\n`;
    reportContent += `---\n\n`;

    // 3. 分析匹配失败的原因
    reportContent = analyzeMatchFailure(targetMarket, polyMarkets, reportContent);

    // 4. 生成报告文件
    await writeFile(
      join(process.cwd(), 'diagnosis_report.md'),
      reportContent,
      'utf-8'
    );

    console.log('✅ 诊断完成，请打开 diagnosis_report.md 查看详情。');
  } catch (error: any) {
    reportContent += `\n\n## ❌ 错误\n\n`;
    reportContent += `执行过程中发生错误：\n\n`;
    reportContent += `\`\`\`\n${error.message}\n${error.stack}\n\`\`\`\n`;
    
    await writeFile(
      join(process.cwd(), 'diagnosis_report.md'),
      reportContent,
      'utf-8'
    );
    
    console.error('❌ 诊断失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行诊断
diagnose();
