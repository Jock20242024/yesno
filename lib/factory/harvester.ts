/**
 * 标准模板抓取器
 * 从 Polymarket 抓取 BTC/ETH 周期性盘口模板并保存到 MarketTemplates 表
 */

import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

interface PolymarketMarket {
  id: string;
  question?: string;
  title?: string;
  slug?: string;
  tags?: string[] | Array<{ id?: string; name?: string; slug?: string }>;
  group_id?: string;
  closed?: boolean;
  [key: string]: any; // 允许其他字段用于调试
}

/**
 * 从 Polymarket Gamma API 获取市场列表
 */
async function fetchPolymarketMarkets(query?: string, limit: number = 100, offset: number = 0): Promise<PolymarketMarket[]> {
  try {
    const params = new URLSearchParams();
    params.append('closed', 'false');
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    if (query) {
      params.append('query', query);
    }
    
    const apiUrl = `https://gamma-api.polymarket.com/markets?${params.toString()}`;

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const markets = Array.isArray(data) ? data : (data.markets || []);

    return markets;
  } catch (error) {
    console.error('❌ [Harvester] 获取 Polymarket 市场失败:', error);
    throw error;
  }
}

/**
 * 从市场标题中提取周期（分钟）
 * 例如："BTC 15min" -> 15, "ETH 1h" -> 60, "BTC 1d" -> 1440
 */
function extractPeriod(text: string): number | null {
  const lowerText = text.toLowerCase();
  
  // 匹配 15min, 30min, 60min 等
  const minMatch = lowerText.match(/(\d+)\s*min/i);
  if (minMatch) {
    return parseInt(minMatch[1]);
  }
  
  // 匹配 1h, 2h, 24h 等
  const hourMatch = lowerText.match(/(\d+)\s*h/i);
  if (hourMatch) {
    return parseInt(hourMatch[1]) * 60;
  }
  
  // 匹配 1d, 2d 等
  const dayMatch = lowerText.match(/(\d+)\s*d/i);
  if (dayMatch) {
    return parseInt(dayMatch[1]) * 1440;
  }
  
  return null;
}

/**
 * 检查是否为周期性盘口（15m, 1h, 1d）
 * 放宽条件：只要包含 BTC、ETH、SOL 且标题包含时间点或价格点，就尝试匹配
 */
function isPeriodicMarket(market: PolymarketMarket, filterReason?: { title: string; reason: string }[]): boolean {
  const question = (market.question || market.slug || '').toLowerCase();
  const title = market.question || market.slug || '';
  
  // 检查是否包含 BTC、ETH 或 SOL
  const hasCrypto = question.includes('btc') || question.includes('bitcoin') || 
                    question.includes('eth') || question.includes('ethereum') ||
                    question.includes('sol') || question.includes('solana');
  
  if (!hasCrypto) {
    if (filterReason && filterReason.length < 5) {
      filterReason.push({ title, reason: '不包含加密货币关键词（BTC/ETH/SOL）' });
    }
    return false;
  }
  
  // 检查是否包含时间点（如 "at 4:00 PM", "at 3pm", "by 4pm"）或价格点（如 "above $", "below $", ">$"）
  const hasTimePoint = /at\s+\d{1,2}[:.]?\d{0,2}\s*(am|pm|AM|PM)/i.test(question) ||
                       /by\s+\d{1,2}[:.]?\d{0,2}\s*(am|pm|AM|PM)/i.test(question) ||
                       /\d{1,2}[:.]?\d{0,2}\s*(am|pm|AM|PM)/i.test(question);
  
  const hasPricePoint = /above\s+\$/i.test(question) ||
                        /below\s+\$/i.test(question) ||
                        />\s*\$/i.test(question) ||
                        /<\s*\$/i.test(question);
  
  // 提取周期（先尝试传统方式）
  let period = extractPeriod(question);
  
  // 如果能提取到周期（15分钟、1小时、1天），则接受
  if (period === 15 || period === 60 || period === 1440) {
    return true;
  }
  
  // 如果无法提取周期，但包含时间点或价格点，也尝试匹配（可能是指定时间点的盘口）
  if ((hasTimePoint || hasPricePoint) && !period) {
    return true;
  }
  
  if (filterReason && filterReason.length < 5) {
    filterReason.push({ title, reason: `不包含周期关键词或时间/价格点（提取到的周期: ${period || '无'}）` });
  }
  
  return false;
}

/**
 * 从市场标题中提取标的符号
 */
/**
 * 从标题中提取资产符号（支持多种加密资产）
 * 改进：使用单词边界匹配，避免误匹配（如"Canada"不匹配"ADA"）
 */
function extractSymbol(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  // 常见加密资产映射（按优先级排序，避免误匹配）
  // 使用单词边界确保精确匹配
  const assetMappings: Array<[RegExp[], string]> = [
    [[/\bbtc\b/i, /\bbitcoin\b/i], 'BTC/USD'],
    [[/\beth\b/i, /\bethereum\b/i], 'ETH/USD'],
    [[/\bsol\b/i, /\bsolana\b/i], 'SOL/USD'],
    [[/\blink\b/i, /\bchainlink\b/i], 'LINK/USD'],
    [[/\bdoge\b/i, /\bdogecoin\b/i], 'DOGE/USD'],
    [[/\bavax\b/i, /\bavalanche\b/i], 'AVAX/USD'],
    [[/\bada\b/i, /\bcardano\b/i], 'ADA/USD'],
    [[/\bdot\b/i, /\bpolkadot\b/i], 'DOT/USD'],
    [[/\bmatic\b/i, /\bpolygon\b/i], 'MATIC/USD'],
    [[/\bxrp\b/i, /\bripple\b/i], 'XRP/USD'],
    [[/\bbnb\b/i], 'BNB/USD'], // 注意：不要匹配"binance"因为它可能在"Airbnb"中出现
    [[/\btrx\b/i, /\btron\b/i], 'TRX/USD'],
    [[/\bltc\b/i, /\blitecoin\b/i], 'LTC/USD'],
    [[/\bbch\b/i, /\bbitcoin\s+cash\b/i], 'BCH/USD'],
    [[/\bxlm\b/i, /\bstellar\b/i], 'XLM/USD'],
    [[/\balgo\b/i, /\balgorand\b/i], 'ALGO/USD'],
    [[/\batom\b/i, /\bcosmos\b/i], 'ATOM/USD'],
    [[/\bfil\b/i, /\bfilecoin\b/i], 'FIL/USD'],
    [[/\bnear\b/i], 'NEAR/USD'],
    [[/\bftm\b/i, /\bfantom\b/i], 'FTM/USD'],
  ];
  
  for (const [patterns, symbol] of assetMappings) {
    // 检查是否匹配任何模式（使用单词边界）
    const matched = patterns.some(pattern => pattern.test(lowerText));
    
    if (matched) {
      return symbol;
    }
  }
  
  return null;
}

/**
 * 探测模式：打印最热市场的标签结构
 */
export async function diagnoseMarketTags(): Promise<void> {
  try {

    // 获取最热的100个市场（按交易量排序）
    const params = new URLSearchParams();
    params.append('closed', 'false');
    params.append('limit', '100');
    params.append('offset', '0');
    params.append('order', 'volume');
    params.append('ascending', 'false');
    
    const apiUrl = `https://gamma-api.polymarket.com/markets?${params.toString()}`;

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status} ${response.statusText}`);
    }

    const markets = await response.json();
    const marketList = Array.isArray(markets) ? markets : (markets.markets || []);

    // 打印前3个市场的完整结构（用于调试）

    marketList.slice(0, 3).forEach((market: any, index: number) => {

    });
    
    // 打印每个市场的 title、tags 和可能的标签字段

    marketList.forEach((market: any, index: number) => {
      const title = market.title || market.question || 'N/A';
      const tags = market.tags || [];
      const groupId = market.group_id || market.groupId || market.group || 'N/A';
      
      // 检查是否包含15分钟相关的关键词
      const titleLower = title.toLowerCase();
      const is15min = titleLower.includes('15') && (titleLower.includes('min') || titleLower.includes('minute'));
      const is1h = titleLower.includes('1h') || (titleLower.includes('1') && titleLower.includes('hour'));
      const is1d = titleLower.includes('1d') || (titleLower.includes('1') && titleLower.includes('day'));
      const isPeriodic = is15min || is1h || is1d;
      
      // 只打印周期性市场或前20个市场
      if (isPeriodic || index < 20) {

        // 打印所有可能包含标签信息的字段
        const tagFields = ['tag_id', 'tag_ids', 'tagId', 'tagIds', 'category', 'categories', 'category_id', 'categoryId', 'group', 'group_id', 'groupId'];
        tagFields.forEach(field => {
          if (market[field] !== undefined && market[field] !== null) {

          }
        });
      }
    });

    // 统计所有标签
    const tagCounts = new Map<string, number>();
    const tagIds = new Map<string, Set<string>>();
    
    marketList.forEach((market: any) => {
      const tags = market.tags || [];
      const title = (market.title || market.question || '').toLowerCase();
      const is15min = title.includes('15') && (title.includes('min') || title.includes('minute'));
      
      if (Array.isArray(tags)) {
        tags.forEach((tag: any) => {
          if (typeof tag === 'string') {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          } else if (tag && typeof tag === 'object') {
            const tagId = tag.id || tag.tag_id || 'unknown';
            const tagName = tag.name || tag.slug || JSON.stringify(tag);
            const key = `${tagId}:${tagName}`;
            tagCounts.set(key, (tagCounts.get(key) || 0) + 1);
            
            if (is15min && tagId !== 'unknown') {
              if (!tagIds.has(tagId)) {
                tagIds.set(tagId, new Set());
              }
              tagIds.get(tagId)!.add(market.id);
            }
          }
        });
      }
    });

    Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .forEach(([tag, count]) => {

      });
    
    if (tagIds.size > 0) {

      tagIds.forEach((marketIds, tagId) => {

      });
    }

  } catch (error) {
    console.error('❌ [Harvester Diagnostic] 探测失败:', error);
    throw error;
  }
}

/**
 * 基于 Tag ID 抓取标准模板
 * @param tagIds 要抓取的标签ID数组（例如：['tag-id-1', 'tag-id-2']）
 */
async function fetchMarketsByTagIds(tagIds: string[]): Promise<PolymarketMarket[]> {
  const allMarkets: PolymarketMarket[] = [];
  
  for (const tagId of tagIds) {
    try {
      // 使用 tag_id 参数过滤市场
      const params = new URLSearchParams();
      params.append('closed', 'false');
      params.append('limit', '100');
      params.append('offset', '0');
      params.append('tag_id', tagId);
      
      const apiUrl = `https://gamma-api.polymarket.com/markets?${params.toString()}`;

      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        console.warn(`⚠️ [Harvester] Tag ID ${tagId} 请求失败: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const markets = Array.isArray(data) ? data : (data.markets || []);

      allMarkets.push(...markets);
    } catch (error) {
      console.error(`❌ [Harvester] Tag ID ${tagId} 请求失败:`, error);
    }
  }
  
  // 去重
  return Array.from(new Map(allMarkets.map(m => [m.id, m])).values());
}

/**
 * 从 Polymarket Series API 获取系列详情（包含events/markets）
 */
async function fetchSeriesDetails(seriesId: string): Promise<any | null> {
  try {
    const apiUrl = `https://gamma-api.polymarket.com/series/${seriesId}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`⚠️ [Harvester] 系列 ${seriesId} 不存在`);
        return null;
      }
      throw new Error(`Polymarket Series API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`❌ [Harvester] 获取系列详情失败 (ID: ${seriesId}):`, error);
    return null;
  }
}

/**
 * 从系列标题或recurrence中提取周期（分钟）
 */
function extractPeriodFromSeries(series: any): number | null {
  const title = ((series.title || '') + ' ' + (series.slug || '')).toLowerCase();
  const recurrence = (series.recurrence || '').toLowerCase();
  
  // 优先匹配更具体的模式，避免误匹配
  
  // 匹配 15min, 15-minute, 15m（最高优先级，避免被其他匹配）
  if (title.includes('15') && (title.includes('min') || title.includes('minute') || title.includes('15m'))) {
    return 15;
  }
  
  // 匹配 4-hour, 4h（优先级高于hourly和daily）
  if (title.includes('4h') || (title.includes('4') && title.includes('hour'))) {
    return 240; // 4小时 = 240分钟
  }
  
  // 匹配 monthly（优先级高于weekly）
  if (title.includes('monthly') || (title.includes('month') && !title.includes('weekly'))) {
    return 43200; // 1月 = 43200分钟（30天）
  }
  
  // 匹配 weekly
  if (title.includes('weekly') || title.includes('week')) {
    return 10080; // 1周 = 10080分钟
  }
  
  // 匹配 daily（但排除4h、weekly、monthly）
  if (title.includes('daily') || (title.includes('day') && !title.includes('week') && !title.includes('month'))) {
    return 1440; // 1天 = 1440分钟
  }
  
  // 匹配 hourly, 1h, hour（但不是4-hour）
  if (title.includes('hourly') || (title.includes('hour') && !title.includes('4'))) {
    return 60;
  }
  
  // 如果没有明确的周期标识，检查 recurrence
  if (recurrence === 'monthly') return 43200;
  if (recurrence === 'weekly') return 10080;
  if (recurrence === 'daily') return 1440;
  if (recurrence === 'hourly') return 60;
  
  return null;
}

/**
 * 从标题中识别模板类型
 * 返回: 'UP_OR_DOWN' | 'HIT_PRICE' | 'NEG_RISK' | 'MULTI_STRIKES' | 'OTHER'
 */
function extractTemplateType(title: string, seriesTitle?: string): string {
  const lowerTitle = title.toLowerCase();
  const lowerSeries = (seriesTitle || '').toLowerCase();
  const combined = lowerTitle + ' ' + lowerSeries;
  
  // 识别 NEG_RISK（优先级最高）
  if (combined.includes('neg risk') || combined.includes('negrisk')) {
    return 'NEG_RISK';
  }
  
  // 识别 MULTI_STRIKES（在系列标题或市场标题中）
  if (combined.includes('multi strikes') || combined.includes('multi-strikes') || combined.includes('strikes')) {
    return 'MULTI_STRIKES';
  }
  
  // 识别 HIT_PRICE
  if (lowerTitle.includes('hit') && (lowerTitle.includes('price') || lowerTitle.includes('what price'))) {
    return 'HIT_PRICE';
  }
  
  // 识别 UP_OR_DOWN
  if (lowerTitle.includes('up or down') || lowerTitle.includes('above') || lowerTitle.includes('below')) {
    return 'UP_OR_DOWN';
  }
  
  // 默认返回 UP_OR_DOWN
  return 'UP_OR_DOWN';
}

/**
 * 检查一系列市场是否包含多个不同价格点（用于识别MULTI_STRIKES）
 */
function hasMultiplePricePoints(events: any[]): boolean {
  const prices = new Set<string>();
  const pricePattern = /\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
  
  for (const event of events.slice(0, 10)) { // 只检查前10个
    const title = (event.title || event.question || '').toLowerCase();
    const matches = title.match(pricePattern);
    if (matches && matches.length > 0) {
      matches.forEach((m: string) => prices.add(m));
    }
  }
  
  return prices.size > 1;
}

/**
 * 从标题中提取模板（将价格和时间替换为占位符）
 * 例如: "Ethereum Up or Down - October 24, 10:15AM-10:30AM ET" -> "Will ETH be above $[StrikePrice] at [EndTime]?"
 * 例如: "Will BTC be above $98,000 at 4:00 PM?" -> "Will BTC be above $[StrikePrice] at [EndTime]?"
 * 例如: "What price will Bitcoin hit in February?" -> "What price will BTC hit in [EndTime]?"
 */
function extractTitleTemplate(title: string): string {
  const lowerTitle = title.toLowerCase();
  let template = title;
  
  // 替换资产名称为标准格式（支持多种资产）
  const assetReplacements: Array<[RegExp, string]> = [
    [/\b(Bitcoin|bitcoin)\b/gi, 'BTC'],
    [/\b(Ethereum|ethereum)\b/gi, 'ETH'],
    [/\b(Solana|solana)\b/gi, 'SOL'],
    [/\b(Chainlink|LINK)\b/gi, 'LINK'],
    [/\b(Dogecoin|DOGE)\b/gi, 'DOGE'],
    [/\b(Avalanche|AVAX)\b/gi, 'AVAX'],
    [/\b(Cardano|ADA)\b/gi, 'ADA'],
    [/\b(Polkadot|DOT)\b/gi, 'DOT'],
    [/\b(Polygon|MATIC)\b/gi, 'MATIC'],
    [/\b(Ripple|XRP)\b/gi, 'XRP'],
    [/\b(Binance Coin|BNB)\b/gi, 'BNB'],
  ];
  
  for (const [regex, replacement] of assetReplacements) {
    template = template.replace(regex, replacement);
  }
  
  // 如果是 "Up or Down" 格式，使用通用模板（不再硬编码资产）
  if (lowerTitle.includes('up or down')) {
    // 使用通用占位符 [Asset]，由extractSymbol识别具体资产
    return 'Will [Asset] be above $[StrikePrice] at [EndTime]?';
  }
  
  // 如果是 "Hit Price" 格式，处理特殊模板
  if (lowerTitle.includes('hit') && lowerTitle.includes('price')) {
    // 替换月份
    template = template.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi, '[EndTime]');
    return template;
  }
  
  // 如果是 "Multi Strikes" 或其他格式，尝试通用替换
  // 替换价格模式 ($98,000, $123456.78 等)
  template = template.replace(/\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g, '$[StrikePrice]');
  
  // 替换时间模式：先处理日期格式 (April 12, April 12, 2025, etc.)
  template = template.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,\s+\d{4})?/gi, '[EndTime]');
  
  // 替换时间范围格式 (10:15AM-10:30AM ET)
  template = template.replace(/\d{1,2}:\d{2}[AP]M-\d{1,2}:\d{2}[AP]M/gi, '[EndTime]');
  
  // 替换时间格式 (4:00 PM ET, 10:15AM ET, etc.)
  template = template.replace(/\b\d{1,2}:\d{2}\s*(?:AM|PM)?\s*(?:ET|EST|EDT|UTC)?\b/gi, '[EndTime]');
  template = template.replace(/\b\d{1,2}:\d{2}\s*(?:AM|PM)?\b/gi, '[EndTime]');
  
  // 替换单独的月份名称（用于Hit Price等格式，但要避免替换已经处理过的）
  // 只替换不在已替换模式中的月份
  template = template.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi, '[EndTime]');
  
  // 替换日期格式 (June 30, by June 30, on April 12, etc.)
  template = template.replace(/\b(on|by|before|after)\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}/gi, '$1 [EndTime]');
  
  // 清理多余的空白
  template = template.replace(/\s+/g, ' ').trim();
  
  return template;
}

/**
 * 从 Polymarket 抓取标准模板（基于 Series 逻辑）
 * 抓取6个分类：15-minute、Hourly、4-hour、Daily、Weekly、Monthly
 */
export async function harvestStandardTemplates(tagIdMap?: { [period: number]: string }): Promise<{
  success: boolean;
  created: number;
  skipped: number;
  errors: number;
}> {
  const stats = {
    success: false,
    created: 0,
    skipped: 0,
    errors: 0,
  };

  try {

    // 1. 获取所有系列
    const params = new URLSearchParams();
    params.append('limit', '1000');
    const seriesUrl = `https://gamma-api.polymarket.com/series?${params.toString()}`;

    const seriesResponse = await fetch(seriesUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!seriesResponse.ok) {
      throw new Error(`Polymarket Series API error: ${seriesResponse.status}`);
    }

    const allSeries = await seriesResponse.json();
    const seriesList = Array.isArray(allSeries) ? allSeries : (allSeries.series || []);

    // 2. 查找目标系列（所有加密资产的6个周期）
    const targetSeries: { period: number; series: any }[] = [];
    // 扩大资产识别范围：支持所有常见加密资产（使用单词边界匹配）
    const cryptoKeywords = [
      '\\bbtc\\b', '\\bbitcoin\\b', '\\beth\\b', '\\bethereum\\b', '\\bsol\\b', '\\bsolana\\b',
      '\\blink\\b', '\\bchainlink\\b', '\\bdoge\\b', '\\bdogecoin\\b', '\\bavax\\b', '\\bavalanche\\b',
      '\\bada\\b', '\\bcardano\\b', '\\bdot\\b', '\\bpolkadot\\b', '\\bmatic\\b', '\\bpolygon\\b',
      '\\bxrp\\b', '\\bripple\\b', '\\bbnb\\b', '\\btrx\\b', '\\btron\\b',
      '\\bltc\\b', '\\blitecoin\\b', '\\bbch\\b', '\\bxlm\\b', '\\bstellar\\b',
      '\\balgo\\b', '\\balgorand\\b', '\\batom\\b', '\\bcosmos\\b', '\\bfil\\b', '\\bfilecoin\\b',
      '\\bnear\\b', '\\bftm\\b', '\\bfantom\\b'
    ];
    
    for (const series of seriesList) {
      const title = ((series.title || '') + ' ' + (series.slug || '')).toLowerCase();
      
      // 提取周期（优先提取周期，因为周期匹配更准确）
      const period = extractPeriodFromSeries(series);
      if (!period || ![15, 60, 240, 1440, 10080, 43200].includes(period)) {
        continue;
      }
      
      // 对于15分钟和Hourly（60分钟）周期，强制扫描所有系列，不限制资产类型
      // 其他周期仍然需要加密资产匹配
      if (period === 15 || period === 60) {
        // 15m和1h系列：不限制资产，全部扫描（因为需要确保抓取到全部4个模板）
        targetSeries.push({ period, series });
      } else {
        // 其他周期：需要匹配加密资产
        const hasCrypto = cryptoKeywords.some(kw => {
          const regex = new RegExp(kw, 'i');
          return regex.test(title);
        });
        
        if (hasCrypto) {
          targetSeries.push({ period, series });
        }
      }
    }

    // 3. 按周期分组，每个周期只取第一个系列（避免重复）
    const seriesByPeriod: { [period: number]: any } = {};
    const processedTemplates = new Set<string>(); // 用于去重: "symbol-period"
    
    for (const { period, series } of targetSeries) {
      if (!seriesByPeriod[period]) {
        seriesByPeriod[period] = [];
      }
      seriesByPeriod[period].push(series);
    }
    
    // 4. 遍历每个周期的系列
    for (const [periodStr, seriesList] of Object.entries(seriesByPeriod)) {
      const period = parseInt(periodStr);

      for (const series of seriesList) {
        try {

          // 获取系列详情（包含events/markets）
          const seriesDetails = await fetchSeriesDetails(series.id);
          if (!seriesDetails || !seriesDetails.events || seriesDetails.events.length === 0) {
            console.warn(`    ⚠️ 系列没有events，跳过`);
            stats.skipped++;
            continue;
          }
          
          const events = seriesDetails.events;
          // 对于15分钟和1小时周期，处理更多市场以确保提取到所有资产模板
          // 优先使用活跃市场，如果没有活跃市场则使用已关闭的市场
          const activeEvents = events.filter((e: any) => e.active !== false && e.closed !== true);
          // 对于15m和1h周期，处理更多样本（50个）以确保找到所有资产
          const sampleSize = (period === 15 || period === 60) ? 50 : 10;
          const eventsToProcess = activeEvents.length > 0 ? activeEvents : events.slice(0, sampleSize);

          if (eventsToProcess.length === 0) {
            console.warn(`    ⚠️ 系列没有可处理的市场，跳过`);
            stats.skipped++;
            continue;
          }
          
          // 检查是否包含多个价格点（用于识别MULTI_STRIKES）
          const isMultiStrikes = hasMultiplePricePoints(eventsToProcess) || 
                                 (series.title || '').toLowerCase().includes('strikes') ||
                                 (series.slug || '').toLowerCase().includes('strikes');
          
          // 🔥 红蓝双轨制：跳过标准周期的涨跌盘口（由工厂生成）
          // 标准周期：15m, 1h, 4h, 1d, 1w, 1M 的 UP_OR_DOWN 类型由工厂生成，采集源应跳过
          const isStandardPeriod = [15, 60, 240, 1440, 10080, 43200].includes(period);
          const isUpOrDownSeries = (series.title || '').toLowerCase().includes('up or down') || 
                                    (series.title || '').toLowerCase().includes('up/down');
          
          if (isStandardPeriod && isUpOrDownSeries) {

            stats.skipped++;
            continue;
          }
          
          // 遍历所有市场，提取不同的模板
          const templatesInSeries = new Map<string, { symbol: string; type: string; titleTemplate: string }>();
          
          // 首先尝试从系列标题中提取资产（作为后备）
          const seriesSymbol = extractSymbol(series.title || series.slug || '');
          
          for (const event of eventsToProcess) {
            const title = event.title || event.question || '';
            
            if (!title) {
              continue;
            }
            
            // 提取标的符号（优先从市场标题，如果失败则使用系列标题）
            let symbol = extractSymbol(title);
            if (!symbol && seriesSymbol) {
              symbol = seriesSymbol;
            }
            if (!symbol) {
              continue;
            }
            
            // 提取标题模板
            let titleTemplate: string;
            try {
              titleTemplate = extractTitleTemplate(title);
              if (!titleTemplate || titleTemplate.trim().length === 0) {
                titleTemplate = title;
              }
              // 将 [Asset] 占位符替换为实际的资产符号
              titleTemplate = titleTemplate.replace(/\[Asset\]/g, symbol.split('/')[0]);
            } catch (error: any) {
              titleTemplate = title;
            }
            
            // 识别模板类型（如果系列是多档位，优先识别为MULTI_STRIKES）
            let templateType = extractTemplateType(title, series.title);
            if (isMultiStrikes && !title.toLowerCase().includes('neg risk')) {
              templateType = 'MULTI_STRIKES';
            }
            
            // 使用 symbol-period-type 作为唯一键
            const templateKey = `${symbol}-${period}-${templateType}`;
            
            // 如果这个组合还没处理过，添加到待处理列表
            if (!templatesInSeries.has(templateKey) && !processedTemplates.has(templateKey)) {
              templatesInSeries.set(templateKey, { symbol, type: templateType, titleTemplate });
            }
          }
          
          // 处理这个系列中提取到的所有唯一模板
          for (const [templateKey, { symbol, type: templateType, titleTemplate }] of templatesInSeries.entries()) {
            processedTemplates.add(templateKey);

            // 检查数据库是否已存在（使用 symbol + period + type）
            const existingTemplate = await prisma.market_templates.findFirst({
              where: { symbol, period, type: templateType },
            });

            // 🔥 确保seriesId正确转换为字符串
            const seriesIdStr = series.id ? String(series.id) : null;
            if (!seriesIdStr) {
              console.warn(`    ⚠️ 系列ID无效，跳过模板 ${symbol} ${period}分钟 ${templateType}`);
              continue;
            }

            if (existingTemplate) {
              // 更新现有模板
              try {
                await prisma.market_templates.update({
                  where: { id: existingTemplate.id },
                  data: {
                    name: titleTemplate,
                    titleTemplate: titleTemplate,
                    categorySlug: 'crypto',
                    type: templateType,
                    seriesId: seriesIdStr, // 🔥 存储series_id用于后续价格获取
                  },
                });

                stats.created++;
              } catch (dbError: any) {
                console.error(`    ❌ 更新模板失败 (${symbol} ${period}分钟 ${templateType}):`, dbError.message);
                console.error(`    错误详情:`, dbError);
                if (dbError.code) {
                  console.error(`    Prisma错误代码: ${dbError.code}`);
                }
                stats.errors++;
              }
            } else {
              // 创建新模板
              try {
                await prisma.market_templates.create({
                  data: {
                    id: randomUUID(),
                    updatedAt: new Date(),
                    name: titleTemplate,
                    titleTemplate: titleTemplate,
                    symbol,
                    period,
                    type: templateType,
                    advanceTime: 120,
                    isActive: true,
                    status: 'ACTIVE',
                    failureCount: 0,
                    categorySlug: 'crypto',
                    seriesId: seriesIdStr, // 🔥 存储series_id用于后续价格获取
                  },
                });

                stats.created++;
              } catch (dbError: any) {
                console.error(`    ❌ 创建模板失败 (${symbol} ${period}分钟 ${templateType}):`, dbError.message);
                console.error(`    错误详情:`, dbError);
                if (dbError.code) {
                  console.error(`    Prisma错误代码: ${dbError.code}`);
                }
                if (dbError.meta) {
                  console.error(`    Prisma错误元数据:`, JSON.stringify(dbError.meta, null, 2));
                }
                stats.errors++;
              }
            }
          }
          
          if (templatesInSeries.size === 0) {
            console.warn(`    ⚠️ 系列中没有可提取的模板，跳过`);
            stats.skipped++;
          }
        } catch (error: any) {
          const seriesIdStr = series?.id ? String(series.id) : 'unknown';
          console.error(`    ❌ 处理系列失败 (ID: ${seriesIdStr}, Title: ${series?.title || 'unknown'}):`);
          console.error(`    错误消息: ${error.message || String(error)}`);
          if (error.stack) {
            console.error(`    错误堆栈:`, error.stack);
          }
          if (error.code) {
            console.error(`    错误代码: ${error.code}`);
          }
          if (error.meta) {
            console.error(`    Prisma错误元数据:`, JSON.stringify(error.meta, null, 2));
          }
          // 打印更多调试信息
          console.error(`    系列数据:`, {
            id: series?.id,
            title: series?.title,
            slug: series?.slug,
          });
          stats.errors++;
          // 🔥 即使某个系列失败，也继续处理下一个
          continue;
        }
      }
    }

    stats.success = true;

    return stats;
  } catch (error) {
    console.error('❌ [Harvester] 抓取标准模板失败:', error);
    throw error;
  }
}
