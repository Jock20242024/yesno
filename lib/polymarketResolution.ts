/**
 * 🔥 Polymarket 结算结果查询服务
 * 根据业务方核心逻辑：判决权在 Polymarket，我们的市场胜负完全同步 Polymarket 的结算结果
 */

/**
 * 从 Polymarket API 获取市场的结算结果
 * @param conditionId Polymarket condition ID 或 market ID
 * @returns Promise<{ resolved: boolean, outcome: 'YES' | 'NO' | null, error?: string }>
 */
export async function getPolymarketResolution(conditionId: string): Promise<{
  resolved: boolean;
  outcome: 'YES' | 'NO' | null;
  error?: string;
}> {
  try {
    // 使用 Polymarket CLOB API 获取市场信息
    // API: https://clob.polymarket.com/markets/{conditionId}
    const url = `https://clob.polymarket.com/markets/${conditionId}`;
    
    console.log(`📡 [Polymarket Resolution] 查询结算结果: conditionId=${conditionId}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 60 }, // 缓存 60 秒
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          resolved: false,
          outcome: null,
          error: 'Market not found in Polymarket (可能已归档或不存在)',
        };
      }
      throw new Error(`Polymarket API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Polymarket API 返回的市场数据中，检查结算状态
    // 根据 Polymarket API 文档，检查 resolved 字段和 winner 字段
    const isResolved = data.resolved === true || data.resolution !== undefined;
    
    if (!isResolved) {
      return {
        resolved: false,
        outcome: null,
      };
    }

    // 获取结算结果
    // Polymarket API 可能使用以下字段之一来表示结算结果：
    // - resolution: "YES" | "NO" | "INVALID"
    // - winner: 0 (NO) 或 1 (YES) 或 "0"/"1"
    // - outcome: "YES" | "NO"
    // - resolvedOutcome: "YES" | "NO"
    // - conditionResolution: { payoutNumerators: [0, 1] } 或 [1, 0]
    let outcome: 'YES' | 'NO' | null = null;
    
    // 尝试多种可能的字段
    if (data.resolution) {
      // 如果直接提供了 resolution 字段
      const resolution = String(data.resolution).toUpperCase().trim();
      if (resolution === 'YES' || resolution === 'TRUE' || resolution === '1') {
        outcome = 'YES';
      } else if (resolution === 'NO' || resolution === 'FALSE' || resolution === '0') {
        outcome = 'NO';
      }
    } else if (data.winner !== undefined && data.winner !== null) {
      // 如果提供了 winner 字段（0 = NO, 1 = YES）
      const winner = Number(data.winner);
      outcome = (winner === 1 || winner === '1' || data.winner === '1') ? 'YES' : 'NO';
    } else if (data.outcome) {
      // 如果提供了 outcome 字段
      const outcomeStr = String(data.outcome).toUpperCase().trim();
      if (outcomeStr === 'YES' || outcomeStr === 'TRUE' || outcomeStr === '1') {
        outcome = 'YES';
      } else if (outcomeStr === 'NO' || outcomeStr === 'FALSE' || outcomeStr === '0') {
        outcome = 'NO';
      }
    } else if (data.resolvedOutcome) {
      // 如果提供了 resolvedOutcome 字段
      const resolvedStr = String(data.resolvedOutcome).toUpperCase().trim();
      if (resolvedStr === 'YES' || resolvedStr === 'TRUE' || resolvedStr === '1') {
        outcome = 'YES';
      } else if (resolvedStr === 'NO' || resolvedStr === 'FALSE' || resolvedStr === '0') {
        outcome = 'NO';
      }
    } else if (data.conditionResolution) {
      // 如果提供了 conditionResolution 对象（包含 payoutNumerators）
      const resolution = data.conditionResolution;
      if (resolution.payoutNumerators) {
        const numerators = Array.isArray(resolution.payoutNumerators) 
          ? resolution.payoutNumerators 
          : [];
        // payoutNumerators: [1, 0] 表示 YES 获胜，[0, 1] 表示 NO 获胜
        if (numerators[0] === 1 && numerators[1] === 0) {
          outcome = 'YES';
        } else if (numerators[0] === 0 && numerators[1] === 1) {
          outcome = 'NO';
        }
      }
    }

    if (!outcome) {
      return {
        resolved: true,
        outcome: null,
        error: '无法解析 Polymarket 结算结果（格式未知）',
      };
    }

    console.log(`✅ [Polymarket Resolution] 获取结算结果: conditionId=${conditionId}, outcome=${outcome}`);
    
    return {
      resolved: true,
      outcome,
    };
  } catch (error: any) {
    console.error(`❌ [Polymarket Resolution] 查询失败: conditionId=${conditionId}`, error);
    return {
      resolved: false,
      outcome: null,
      error: error.message || 'Unknown error',
    };
  }
}
