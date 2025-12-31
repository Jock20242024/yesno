import { NextResponse } from 'next/server';

/**
 * 创建禁用缓存的 JSON 响应
 * 🔥 用于确保 API 返回的数据不会被浏览器或 CDN 缓存
 * 
 * @param data 要返回的数据
 * @param status HTTP 状态码（默认 200）
 * @returns NextResponse 配置了禁用缓存头
 */
export function createNoCacheResponse(data: any, status: number = 200): NextResponse {
  const response = NextResponse.json(data, { status });
  
  // 🔥 设置响应头，防止浏览器和 CDN 缓存
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('Surrogate-Control', 'no-store');
  
  return response;
}
