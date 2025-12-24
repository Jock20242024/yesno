export interface NetworkConfig {
  id: string;
  name: string;
  fee: string;
  arrival: string;
}

export interface CryptoConfig {
  networks: NetworkConfig[];
}

export const CRYPTO_CONFIG: Record<string, CryptoConfig> = {
  USDT: {
    networks: [
      { id: "TRC20", name: "Tron (TRC20)", fee: "$1.00", arrival: "2 mins" },
      { id: "ERC20", name: "Ethereum (ERC20)", fee: "$5.00", arrival: "5 mins" },
      { id: "BEP20", name: "BNB Smart Chain (BEP20)", fee: "$0.29", arrival: "1 mins" },
      { id: "POLYGON", name: "Polygon", fee: "$0.10", arrival: "3 mins" },
    ],
  },
  USDC: {
    networks: [
      { id: "POLYGON", name: "Polygon", fee: "$0.10", arrival: "3 mins" },
      { id: "ERC20", name: "Ethereum (ERC20)", fee: "$5.00", arrival: "5 mins" },
    ],
  },
};

// 生成模拟钱包地址
export function generateMockAddress(networkId: string): string {
  if (networkId === "TRC20") {
    // TRC20 地址以 T 开头
    return "TX8" + Array.from({ length: 31 }, () => 
      "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 33)]
    ).join("") + "j9k";
  } else {
    // EVM 地址以 0x 开头
    return "0x" + Array.from({ length: 40 }, () => 
      "0123456789abcdef"[Math.floor(Math.random() * 16)]
    ).join("");
  }
}

// 解析手续费字符串为数字
export function parseFee(feeString: string): number {
  // 🔥 修复：确保在调用 replace 之前先转换为字符串
  return parseFloat(String(feeString || '').replace(/[$,\s]/g, "")) || 0;
}

