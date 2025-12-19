/**
 * Oracle 价格获取服务
 * 从外部 API 获取实时价格
 */

export interface OraclePriceResult {
  price: number;
  timestamp: number;
  source: string;
}

/**
 * 获取 BTC/USD 实时价格
 * 默认使用 CoinGecko API（免费）
 */
export async function getBTCPrice(): Promise<OraclePriceResult> {
  try {
    // 使用 CoinGecko API 获取 BTC 价格
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_last_updated_at=true',
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 10 }, // 缓存 10 秒
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.statusText}`);
    }

    const data = await response.json();
    const price = data.bitcoin?.usd;
    const timestamp = data.bitcoin?.last_updated_at * 1000 || Date.now();

    if (!price || typeof price !== 'number') {
      throw new Error('Invalid price data from CoinGecko');
    }

    return {
      price,
      timestamp,
      source: 'coingecko',
    };
  } catch (error) {
    console.error('❌ [Oracle] 获取 BTC 价格失败:', error);
    
    // 如果 CoinGecko 失败，可以尝试备用 API
    // 这里可以添加其他价格源作为 fallback
    throw new Error(`Failed to fetch BTC price: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * 获取指定标的的实时价格
 * @param symbol 标的符号（如 "BTC/USD"）
 */
export async function getPrice(symbol: string): Promise<OraclePriceResult> {
  // 目前只支持 BTC/USD，可以扩展支持更多标的
  if (symbol.toUpperCase() === 'BTC/USD' || symbol.toUpperCase() === 'BTC-USD') {
    return getBTCPrice();
  }

  throw new Error(`Unsupported symbol: ${symbol}`);
}
